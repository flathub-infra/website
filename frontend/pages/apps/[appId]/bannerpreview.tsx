import { GetStaticPaths, GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"

import EolMessageDetails from "../../../src/components/application/EolMessage"
import { fetchAppstream, fetchEolRebase } from "../../../src/fetchers"
import { NextSeo } from "next-seo"
import { Appstream, DesktopAppstream } from "../../../src/types/Appstream"
import { Trans, useTranslation } from "next-i18next"
import { isValidAppId } from "@/lib/helpers"
import {
  getEolMessageAppidEolMessageAppIdGet,
  getIsFullscreenAppIsFullscreenAppAppIdGet,
} from "src/codegen"
import { HeroBanner } from "src/components/application/HeroBanner"
import { Alert } from "@/components/ui/alert"

export default function Details({
  app,
  eolMessage,
  heroBannerData,
}: {
  app: Appstream
  eolMessage: string
  heroBannerData: {
    app: { position: number; app_id: string; isFullscreen: boolean }
    appstream: DesktopAppstream
  }[]
}) {
  const { t } = useTranslation()

  if (eolMessage) {
    return <EolMessageDetails message={eolMessage} />
  }

  return (
    <>
      <NextSeo
        title={`${app?.name} banner preview`}
        nofollow={true}
        noindex={true}
      />

      <div className="max-w-11/12 mx-auto my-0 mt-4 w-11/12 space-y-10 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <div className="flex flex-wrap">
          <div>
            <Trans i18nKey={"common:quality.banner-preview-description"}>
              To easily experiment with your banner, use{" "}
              <a href="https://docs.flathub.org/banner-preview/">
                the banner preview
              </a>
            </Trans>
          </div>
        </div>

        {!heroBannerData[0].appstream.branding && (
          <Alert variant="destructive">
            {t("quality.missing-brand-colors")}
          </Alert>
        )}
        <HeroBanner
          heroBannerData={heroBannerData}
          aboveTheFold={true}
          autoplay={false}
          forceTheme="light"
        />

        <HeroBanner
          heroBannerData={heroBannerData}
          aboveTheFold={true}
          autoplay={false}
          forceTheme="dark"
        />
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({
  locale,
  defaultLocale,
  params: { appId: appId },
}: {
  locale: string
  defaultLocale: string
  params: { appId: string }
}) => {
  console.log("Fetching data for app hero banner: ", appId, locale)

  const isFlatpakref = (appId as string).endsWith(".flatpakref")

  appId = isFlatpakref
    ? appId.slice(0, appId.length - ".flatpakref".length)
    : appId

  if (!isValidAppId(appId as string)) {
    console.log("Not a valid app id: ", appId)
    return {
      notFound: true,
      revalidate: 60,
    }
  }

  const eolRebaseTo = await fetchEolRebase(appId as string)

  if (eolRebaseTo) {
    const prefix = locale && locale !== defaultLocale ? `/${locale}` : ``

    return {
      redirect: {
        destination: isFlatpakref
          ? `${prefix}/apps/${eolRebaseTo}.flatpakref`
          : `${prefix}/apps/${eolRebaseTo}`,
        permanent: true,
      },
    }
  }

  if (isFlatpakref) {
    return {
      redirect: {
        destination: `https://dl.flathub.org/repo/appstream/${appId}.flatpakref`,
        permanent: true,
      },
    }
  }

  let eolMessage: string | null = null
  const app = await fetchAppstream(appId as string, locale)

  if (!app) {
    eolMessage = (await getEolMessageAppidEolMessageAppIdGet(appId as string))
      .data
  }

  //@ts-ignore
  if ((!app && !eolMessage) || !!app?.detail?.[0]?.type) {
    return {
      notFound: true,
      revalidate: 60,
    }
  }

  const isFullscreen = (
    await getIsFullscreenAppIsFullscreenAppAppIdGet(appId as string)
  ).data

  const heroBannerData: {
    app: { position: number; app_id: string; isFullscreen: boolean }
    appstream: DesktopAppstream
  }[] = [
    {
      app: { position: 1, app_id: appId, isFullscreen },
      appstream: app as DesktopAppstream,
    },
  ]

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      app,
      eolMessage,
      heroBannerData,
    },
    revalidate: 900,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  }
}
