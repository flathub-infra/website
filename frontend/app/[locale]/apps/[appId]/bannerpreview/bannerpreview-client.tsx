"use client"

import { useTranslations } from "next-intl"
import EolMessageDetails from "../../../../../src/components/application/EolMessage"
import { HeroBanner } from "../../../../../src/components/application/HeroBanner"
import { Alert } from "../../../../../@/components/ui/alert"
import { Appstream, DesktopAppstream } from "../../../../../src/types/Appstream"

interface Props {
  app: Pick<Appstream, "id" | "name"> | null
  eolMessage: string | null
  heroBannerData: {
    app: { position: number; app_id: string; isFullscreen: boolean }
    appstream: Pick<
      DesktopAppstream,
      "id" | "name" | "branding" | "icon" | "summary" | "screenshots"
    >
  }[]
}

export default function BannerPreviewClient({
  app,
  eolMessage,
  heroBannerData,
}: Props) {
  const t = useTranslations()

  if (eolMessage) {
    return (
      <>
        {/* <meta name="robots" content="noindex" /> */}
        <EolMessageDetails message={eolMessage} />
      </>
    )
  }

  return (
    <>
      <div className="max-w-11/12 mx-auto my-0 mt-4 w-11/12 flex flex-col gap-y-10 2xl:w-[1400px] 2xl:max-w-[1400px] pb-5">
        <div className="flex flex-wrap">
          <div>
            <h1 className="mt-2 mb-4 text-4xl font-extrabold">
              {t("quality.banner-preview")}
            </h1>
            {t.rich("quality.banner-preview-description", {
              preview: (chunk) => (
                <a href="https://docs.flathub.org/banner-preview/">{chunk}</a>
              ),
            })}
          </div>
        </div>

        {!heroBannerData[0]?.appstream?.branding && (
          <Alert variant="destructive">
            {t("quality.missing-brand-colors")}
          </Alert>
        )}
      </div>

      <div className="bg-flathub-lotion p-20">
        <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
          <HeroBanner
            heroBannerData={heroBannerData}
            aboveTheFold={true}
            autoplay={false}
            forceTheme="light"
          />
        </div>
      </div>

      <div className="bg-flathub-dark-gunmetal p-20">
        <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
          <HeroBanner
            heroBannerData={heroBannerData}
            aboveTheFold={true}
            autoplay={false}
            forceTheme="dark"
          />
        </div>
      </div>
    </>
  )
}
