import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import {
  getAppstreamAppstreamAppIdGet,
  getStatsForAppStatsAppIdGet,
  getSummarySummaryAppIdGet,
  getDeveloperCollectionDeveloperDeveloperGet,
  getAddonsAddonAppIdGet,
  getVerificationStatusVerificationAppIdStatusGet,
  getEolRebaseAppidEolRebaseAppIdGet,
  getEolMessageAppidEolMessageAppIdGet,
  MeilisearchResponseAppsIndex,
  StatsResultApp,
  AddonAppstream,
  GetVerificationStatusVerificationAppIdStatusGet200,
} from "src/codegen"
import { isValidAppId } from "@/lib/helpers"
import AppDetailClient from "./app-detail-client"
import { removeAppIdFromSearchResponse } from "../../../../src/meilisearch"
import { formatISO } from "date-fns"
import { UTCDate } from "@date-fns/utc"
import { redirect } from "src/i18n/navigation"
import { Summary } from "src/types/Summary"

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

  const t = await getTranslations({ locale })

  try {
    const response = await getAppstreamAppstreamAppIdGet(appId, { locale })
    const app = response.data

    return {
      title: t("install-x", { app_name: app?.name }),
      description: app?.summary,
      robots: {
        index: app.type !== "addon" && locale !== "en-GB",
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

  // Enable static rendering
  setRequestLocale(locale)

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
  const eolRebaseResponse = await getEolRebaseAppidEolRebaseAppIdGet(cleanAppId)
  const eolRebaseTo = eolRebaseResponse.data
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
    // Fetch critical data first
    const [appResponse, statsResponse, summaryResponse] = await Promise.all([
      getAppstreamAppstreamAppIdGet(cleanAppId, { locale }),
      getStatsForAppStatsAppIdGet(cleanAppId).catch(() => ({ data: null })),
      getSummarySummaryAppIdGet(cleanAppId),
    ])

    const app = appResponse.data
    const stats: StatsResultApp | null = statsResponse.data
    const summary = summaryResponse.data as unknown as Summary

    // Fetch addons list with fallback
    let addonsList: string[] = []
    try {
      const addonsListResponse = await getAddonsAddonAppIdGet(cleanAppId)
      addonsList = addonsListResponse.data
    } catch (e) {
      addonsList = []
    }

    // Fetch verification status with fallback
    let verificationStatus: GetVerificationStatusVerificationAppIdStatusGet200 | null =
      null
    try {
      const verificationStatusResponse =
        await getVerificationStatusVerificationAppIdStatusGet(cleanAppId)
      verificationStatus =
        verificationStatusResponse.data as unknown as GetVerificationStatusVerificationAppIdStatusGet200
    } catch (e) {
      verificationStatus = {
        verified: false,
        method: "none",
        detail: null,
      }
    }
    // Fetch addon appstreams
    const addonAppstreams = await Promise.all(
      addonsList.map((addonId) =>
        getAppstreamAppstreamAppIdGet(addonId, { locale }),
      ),
    )

    const addonAppStats = await Promise.all(
      addonsList.map((addonId) =>
        getStatsForAppStatsAppIdGet(addonId).catch(() => ({
          data: { id: null, installs_last_month: 0 },
        })),
      ),
    )

    // Combine addon data and sort by installs
    const combined = addonAppstreams
      .filter((response) => response.data && "id" in response.data)
      .map((response) => {
        const addonApp = response.data
        return {
          id: addonApp.id,
          appstream: addonApp,
          stats: addonAppStats.find(
            (statsResponse) => statsResponse.data.id === addonApp.id,
          )?.data,
        }
      })

    combined.sort((a, b) => {
      return (
        (b.stats?.installs_last_month ?? 0) -
        (a.stats?.installs_last_month ?? 0)
      )
    })

    const addons = combined.map((item) => item.appstream) as AddonAppstream[]

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
    const developerAppsResponse =
      app && app.type !== "addon" && app.developer_name
        ? await getDeveloperCollectionDeveloperDeveloperGet(
            app.developer_name,
            {
              page: 1,
              per_page: 7,
              locale,
            },
          )
        : null

    const developerApps = developerAppsResponse?.data ?? null

    // Get date published (matching original pages router logic)
    const datePublished = formatISO(new UTCDate(summary?.timestamp ?? 0 * 1000))

    return (
      <AppDetailClient
        app={app}
        summary={summary}
        stats={stats}
        developerApps={
          developerApps
            ? removeAppIdFromSearchResponse(
                developerApps as MeilisearchResponseAppsIndex,
                app?.id,
              )
            : null
        }
        verificationStatus={verificationStatus}
        eolMessage=""
        addons={addons}
        locale={locale}
        datePublished={datePublished}
      />
    )
  } catch (error) {
    console.error("Error fetching app data:", error)
    notFound()
  }
}
