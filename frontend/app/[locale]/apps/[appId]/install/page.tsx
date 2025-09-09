import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { fetchAppstream } from "../../../../../src/fetchers"
import InstallClient from "./client"
import { languages } from "src/localize"

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
      title: t("download.install-x", { x: app.name }),
      description: app?.summary,
      robots: {
        index: false,
        follow: false,
      },
      alternates: {
        languages: languages
          .filter((lang) => lang !== "en-GB" && lang !== "en") // Exclude en-GB and en from alternates
          .reduce(
            (acc, lang) => {
              acc[lang] =
                `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/${lang}/apps/${app?.id}/install`
              return acc
            },
            {} as Record<string, string>,
          ),
      },
      openGraph: {
        url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/${locale}/apps/${app?.id}/install`,
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

export default async function InstallPage({
  params,
}: {
  params: Promise<{ locale: string; appId: string }>
}) {
  const { locale, appId } = await params

  try {
    const app = await fetchAppstream(appId, locale)

    if (!app) {
      notFound()
    }

    // Use the client component to handle the redirect and fallback
    return <InstallClient app={app} />
  } catch (error) {
    console.error("Error fetching app data:", error)
    notFound()
  }
}
