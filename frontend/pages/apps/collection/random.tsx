import { GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import ApplicationCollection from "../../../src/components/application/Collection"
import fetchCollection from "../../../src/fetchers"
import { Appstream } from "../../../src/types/Appstream"
import { Collections } from "../../../src/types/Collection"

export default function RandomApps({ applications }) {
  const { t } = useTranslation()
  return (
    <>
      <NextSeo title={t("random-apps")} />
      <ApplicationCollection
        title={t("random-apps")}
        applications={applications}
      />
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const applications: Appstream[] = await fetchCollection(
    Collections.randomApps,
  )

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      applications,
    },
    revalidate: 3600,
  }
}
