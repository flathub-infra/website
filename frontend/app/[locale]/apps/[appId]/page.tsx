import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import {
  fetchAppstream,
  fetchAppStats,
  fetchSummary,
  fetchDeveloperApps,
  fetchAddons,
  fetchVerificationStatus,
  fetchEolRebase,
} from "../../../../src/fetchers"
import { isValidAppId } from "@/lib/helpers"
import { languages } from "../../../../src/localize"
import AppDetailClient from "./app-detail-client"
import { getEolMessageAppidEolMessageAppIdGet } from "src/codegen"
import { AddonAppstream } from "../../../../src/types/Appstream"
import { removeAppIdFromSearchResponse } from "../../../../src/meilisearch"
import { formatISO } from "date-fns"
import { UTCDate } from "@date-fns/utc"
import { redirect } from "src/i18n/navigation"

export async function generateStaticParams() {
  // Return empty array to enable ISR for all app IDs
  return []
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; appId: string }>
}): Promise<Metadata> {
  const { locale, appId } = await params
  const t = await getTranslations()

  try {
    const app = await fetchAppstream(appId, locale)

    return {
      title: t("install-x", { app_name: app?.name }),
      description: app?.summary,
      robots: {
        index: app.type !== "addon" && locale !== "en-GB",
      },
      alternates: {
        languages: languages.reduce(
          (acc, lang) => {
            acc[lang] =
              `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/${lang}/apps/${app?.id}`
            return acc
          },
          {} as Record<string, string>,
        ),
      },
      openGraph: {
        url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/${locale}/apps/${app?.id}`,
        images: [
          {
            url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/api/appOgImage/${app?.id}?locale=${locale}`,
            height: 628,
            width: 1200,
            alt: app?.name,
          },
        ],
      },
    }
  } catch (error) {
    return {
      title: t("page-not-found", { errorCode: error?.response?.status }),
    }
  }
}

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ locale: string; appId: string }>
}) {
  const { locale, appId } = await params

  // Handle flatpakref URLs
  let cleanAppId = appId
  const isFlatpakref = appId.endsWith(".flatpakref")
  if (isFlatpakref) {
    cleanAppId = appId.slice(0, appId.length - ".flatpakref".length)
  }

  if (!isValidAppId(cleanAppId)) {
    notFound()
  }

  // Check for EOL rebase redirect
  const eolRebaseTo = await fetchEolRebase(cleanAppId)
  if (eolRebaseTo) {
    const redirectPath = isFlatpakref
      ? `/apps/${eolRebaseTo}.flatpakref`
      : `/apps/${eolRebaseTo}`
    redirect({ href: redirectPath, locale: locale })
  }

  // Handle flatpakref downloads
  if (isFlatpakref) {
    redirect({
      href: `https://dl.flathub.org/repo/appstream/${cleanAppId}.flatpakref`,
      locale: locale,
    })
  }

  const eolMessageResponse = await getEolMessageAppidEolMessageAppIdGet(
    cleanAppId as string,
  )
  let eolMessage: string | null = eolMessageResponse.data

  // If there's an EOL message, return it directly without fetching other data
  if (eolMessage) {
    return (
      <AppDetailClient
        app={null}
        summary={null}
        stats={null}
        developerApps={null}
        verificationStatus={null}
        eolMessage={eolMessage}
        addons={[]}
        locale={locale}
        datePublished=""
      />
    )
  }

  try {
    // Fetch all required data
    const [app, stats, summary, addons, verificationStatus] = await Promise.all(
      [
        fetchAppstream(cleanAppId, locale),
        fetchAppStats(cleanAppId),
        fetchSummary(cleanAppId),
        fetchAddons(cleanAppId, locale),
        fetchVerificationStatus(cleanAppId),
      ],
    )

    // If no app found and no EOL message, show 404
    if (!app) {
      notFound()
    }

    // Additional check for app detail error (matching pages router logic)
    //@ts-ignore
    if (!!app?.detail?.[0]?.type) {
      notFound()
    }

    // Fetch developer apps only for non-addon apps
    const developerApps =
      app && app.type !== "addon"
        ? await fetchDeveloperApps(app.developer_name, locale)
        : null

    // Get date published (matching original pages router logic)
    const datePublished = formatISO(new UTCDate(summary?.timestamp ?? 0 * 1000))

    return (
      <AppDetailClient
        app={app}
        summary={summary}
        stats={stats}
        developerApps={removeAppIdFromSearchResponse(developerApps, app?.id)}
        verificationStatus={verificationStatus}
        eolMessage=""
        addons={addons as AddonAppstream[]}
        locale={locale}
        datePublished={datePublished}
      />
    )
  } catch (error) {
    console.error("Error fetching app data:", error)
    notFound()
  }
}
