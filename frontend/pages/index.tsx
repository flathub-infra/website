import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"

import fetchCollection from "../src/fetchers"
import { APPS_IN_PREVIEW_COUNT, IS_PRODUCTION } from "../src/env"
import { NextSeo } from "next-seo"
import { Collections } from "../src/types/Collection"
import ApplicationSections from "../src/components/application/Sections"
import { useTranslation } from "next-i18next"
import ButtonLink from "src/components/ButtonLink"

export default function Home({
  recentlyUpdated,
  recentlyAdded,
  popular,
  verified,
}) {
  const { t } = useTranslation()
  return (
    <>
      <NextSeo title={t("home")} description={t("flathub-description")} />
      <div className="max-w-11/12 mx-auto my-0 w-11/12 space-y-10 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <div className="flex justify-between gap-3">
          <div className="prose dark:prose-invert">
            <h1 className="my-8">{t("apps-for-linux-right-here")}</h1>
            <p className="introduction mb-10 max-w-2xl text-lg font-light">
              {t("welcome-to-flathub-index-text")}
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink
                variant="secondary"
                href={"https://flatpak.org/setup/"}
                passHref
                aria-label={t("setup-flathub-description")}
              >
                {t("setup-flathub")}
              </ButtonLink>
              <ButtonLink
                variant="secondary"
                href={"/apps"}
                passHref
                aria-label={t("explore-applications")}
              >
                {t("explore")}
              </ButtonLink>
              {!IS_PRODUCTION && (
                <ButtonLink
                  variant="secondary"
                  href={"/donate"}
                  passHref
                  aria-label={t("donate-to", { project: "Flathub" })}
                >
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
          verified={verified}
        ></ApplicationSections>
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const recentlyUpdated = await fetchCollection(
    Collections.recentlyUpdated,
    1,
    APPS_IN_PREVIEW_COUNT,
  )
  const recentlyAdded = await fetchCollection(
    Collections.recentlyAdded,
    1,
    APPS_IN_PREVIEW_COUNT,
  )
  const popular = await fetchCollection(
    Collections.popular,
    1,
    APPS_IN_PREVIEW_COUNT,
  )
  const verified = await fetchCollection(
    Collections.verified,
    1,
    APPS_IN_PREVIEW_COUNT,
  )

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      recentlyUpdated,
      recentlyAdded,
      popular,
      verified,
    },
    revalidate: 900,
  }
}
