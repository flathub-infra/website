import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { getAppstreamAppstreamAppIdGet } from "../../../../../src/codegen"
import InstallClient from "./client"

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
      title: t("download.install-x", { x: app.name }),
      description: app?.summary,
      robots: {
        index: false,
        follow: false,
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

  // Enable static rendering
  setRequestLocale(locale)

  let app: any

  try {
    const response = await getAppstreamAppstreamAppIdGet(appId, { locale })
    app = response.data
  } catch (error) {
    console.error("Error fetching app data:", error)
    notFound()
  }

  // Use the client component to handle the redirect and fallback
  return <InstallClient app={app} />
}
