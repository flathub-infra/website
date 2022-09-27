import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"

import fetchCollection from "../src/fetchers"
import { APPS_IN_PREVIEW_COUNT } from "../src/env"
import { NextSeo } from "next-seo"
import { Collections } from "../src/types/Collection"
import ApplicationSections from "../src/components/application/Sections"
import Button from "../src/components/Button"
import { useTranslation } from "next-i18next"
import Link from "next/link"

export default function Home({
  recentlyUpdated,
  editorsChoiceApps,
  recentlyAdded,
  popular,
}) {
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
              <a href="https://flatpak.org/setup/">
                <Button variant="secondary">{t("quick-setup")}</Button>
              </a>
              <Link href="/apps" passHref>
                <Button variant="secondary">{t("explore")}</Button>
              </Link>
              <Link href="/donate" passHref>
                <Button variant="secondary">
                  {t("donate-to", { project: "Flathub" })}
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <ApplicationSections
          popular={popular}
          recentlyUpdated={recentlyUpdated}
          editorsChoiceApps={editorsChoiceApps}
          recentlyAdded={recentlyAdded}
        ></ApplicationSections>
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
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
      ...(await serverSideTranslations(locale, ["common"])),
      recentlyUpdated,
      recentlyAdded,
      popular,
    },
    revalidate: 3600,
  }
}
