import { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  DesktopAppstream,
  getAppstreamAppstreamAppIdGet,
  getEolRebaseAppidEolRebaseAppIdGet,
} from "../../../../../src/codegen"
import { isValidAppId } from "../../../../../@/lib/helpers"
import {
  getEolMessageAppidEolMessageAppIdGet,
  getIsFullscreenAppIsFullscreenAppAppIdGet,
} from "../../../../../src/codegen"
import BannerPreviewClient from "./bannerpreview-client"
import { redirect } from "src/i18n/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"

interface Params {
  locale: string
  appId: string
}

interface Props {
  params: Promise<Params>
}

export async function generateStaticParams() {
  // Return empty array to enable ISR for all appId combinations
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, appId: rawAppId } = await params

  const t = await getTranslations({ locale })

  // Handle .flatpakref extension
  const isFlatpakref = rawAppId.endsWith(".flatpakref")
  const appId = isFlatpakref
    ? rawAppId.slice(0, rawAppId.length - ".flatpakref".length)
    : rawAppId

  if (!isValidAppId(appId)) {
    return {
      title: `${t("quality.banner-preview")}`,
    }
  }

  try {
    const appResponse = await getAppstreamAppstreamAppIdGet(appId, { locale })
    const app = appResponse.data as any

    return {
      title: app?.name
        ? `${app.name} ${t("quality.banner-preview")}`
        : `${t("quality.banner-preview")}`,
      robots: {
        index: false,
        follow: false,
      },
    }
  } catch (error) {
    return {
      title: `${t("quality.banner-preview")}`,
      robots: {
        index: false,
        follow: false,
      },
    }
  }
}

export default async function BannerPreviewPage({ params }: Props) {
  const { locale, appId: rawAppId } = await params

  // Enable static rendering
  setRequestLocale(locale)

  console.log("Fetching data for app hero banner: ", rawAppId, locale)

  const isFlatpakref = rawAppId.endsWith(".flatpakref")
  const appId = isFlatpakref
    ? rawAppId.slice(0, rawAppId.length - ".flatpakref".length)
    : rawAppId

  if (!isValidAppId(appId)) {
    console.log("Not a valid app id: ", appId)
    notFound()
  }

  // Check for EOL rebase
  const eolRebaseResponse = await getEolRebaseAppidEolRebaseAppIdGet(appId)
  const eolRebaseTo = eolRebaseResponse.data

  if (eolRebaseTo) {
    const destination = isFlatpakref
      ? `/apps/${eolRebaseTo}.flatpakref`
      : `/apps/${eolRebaseTo}`
    redirect({ href: destination, locale: locale })
  }

  // Handle flatpakref redirect
  if (isFlatpakref) {
    redirect({
      href: `https://dl.flathub.org/repo/appstream/${appId}.flatpakref`,
      locale: locale,
    })
  }

  const response = await getAppstreamAppstreamAppIdGet(appId, { locale })
  const app = response.data as any

  const eolMessageResponse = await getEolMessageAppidEolMessageAppIdGet(
    appId as string,
  )
  let eolMessage: string | null = eolMessageResponse.data

  // @ts-ignore - Check for app detail type
  if ((!app && !eolMessage) || !!app?.detail?.[0]?.type) {
    notFound()
  }

  let isFullscreen = false
  try {
    const fullscreenResponse =
      await getIsFullscreenAppIsFullscreenAppAppIdGet(appId)
    isFullscreen = fullscreenResponse.data
  } catch (error) {
    console.error("Error fetching fullscreen status:", error)
  }

  const heroBannerData: {
    app: { position: number; app_id: string; isFullscreen: boolean }
    appstream: DesktopAppstream
  }[] = [
    {
      app: { position: 1, app_id: appId, isFullscreen },
      appstream: app as DesktopAppstream,
    },
  ]

  return (
    <BannerPreviewClient
      app={app}
      eolMessage={eolMessage}
      heroBannerData={heroBannerData}
    />
  )
}
