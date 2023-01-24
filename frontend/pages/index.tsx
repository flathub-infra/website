import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"

import fetchCollection from "../src/fetchers"
import { APPS_IN_PREVIEW_COUNT, IS_PRODUCTION } from "../src/env"
import { NextSeo } from "next-seo"
import { Collections } from "../src/types/Collection"
import ApplicationSections from "../src/components/application/Sections"
import { useTranslation } from "next-i18next"
import ButtonLink from "src/components/ButtonLink"

export default function Home({ recentlyUpdated, recentlyAdded, popular }) {
  const { t } = useTranslation()
  return (
    <>
      <NextSeo title={t("home")} description={t("flathub-description")} />
      <div className="max-w-11/12 my-0 mx-auto w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <div className="flex justify-between gap-3">
          <div>
            <h1>{t("apps-for-linux-right-here")}</h1>
            <p className="introduction mb-10 max-w-2xl text-lg font-light">
              {t("welcome-to-flathub-index-text")}
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink
                variant="secondary"
                href={"https://flatpak.org/setup/"}
                passHref
              >
                {t("quick-setup")}
              </ButtonLink>
              <ButtonLink variant="secondary" href={"/apps"} passHref>
                {t("explore")}
              </ButtonLink>
              {!IS_PRODUCTION && (
                <ButtonLink variant="secondary" href={"/donate"} passHref>
                  {t("donate-to", { project: "Flathub" })}
                </ButtonLink>
              )}
            </div>
          </div>
        </div>

        <ApplicationSections
          popular={popular}
          recentlyUpdated={recentlyUpdated}
          recentlyAdded={recentlyAdded}
        ></ApplicationSections>
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({
  locale,
  defaultLocale,
}) => {
  const recentlyUpdated = await fetchCollection(
    Collections.recentlyUpdated,
    APPS_IN_PREVIEW_COUNT,
  )
  const recentlyAdded = await fetchCollection(
    Collections.recentlyAdded,
    APPS_IN_PREVIEW_COUNT,
  )
  const popular = await fetchCollection(
    Collections.popular,
    APPS_IN_PREVIEW_COUNT,
  )

  return {
    props: {
      ...(await serverSideTranslations(locale ?? defaultLocale, ["common"])),
      recentlyUpdated,
      recentlyAdded,
      popular,
    },
    revalidate: 3600,
  }
}
