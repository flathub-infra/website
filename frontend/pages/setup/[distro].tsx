import { GetStaticPaths, GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useTranslation } from "next-i18next"
import Breadcrumbs from "src/components/Breadcrumbs"
import { DistroSetup, fetchSetupInstructions } from "src/distro-setup"
import { distroMap } from "src/components/setup/Distros"
import React from "react"

export default function Setup({
  distroData,
  locale,
}: {
  distroData: DistroSetup
  locale: string
}) {
  const { t } = useTranslation()

  const translatedDistroName = t(distroData.translatedNameKey)

  const pages = [
    {
      name: t("setup-flathub"),
      href: "/setup",
      current: false,
    },
    {
      name: translatedDistroName,
      href: `/setup/${encodeURIComponent(distroData.name)}`,
      current: true,
    },
  ]

  return (
    <>
      <NextSeo
        title={t("distribution-flathub-setup", {
          distribution: translatedDistroName,
        })}
        description={t("setup-flathub-description")}
        noindex={locale === "en-GB"}
      />
      <div className="max-w-11/12 mx-auto w-11/12 space-y-10 pt-4 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <div className="mx-auto max-w-2xl">
          <Breadcrumbs pages={pages} />
        </div>

        <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
          <div key={distroData.name} className="space-y-4">
            {distroMap.get(distroData.name.replaceAll("/", ""))}
          </div>
        </div>
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({
  locale,
  params: { distro },
}: {
  locale: string
  params: { distro: string }
}) => {
  const instructions = await fetchSetupInstructions()

  let distroData = instructions.find(
    (instruction) => instruction.name === distro,
  )

  if (!distroData) {
    distroData = instructions.find((instruction) => instruction.slug === distro)
  }

  if (!distroData) {
    return {
      notFound: true,
    }
  }

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common", "distros"])),
      distroData,
      locale,
    },
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  }
}
