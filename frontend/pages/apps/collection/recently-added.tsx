import { GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import ApplicationCollection from "../../../src/components/application/Collection"
import fetchCollection from "../../../src/fetchers"
import { Appstream } from "../../../src/types/Appstream"
import { Collections } from "../../../src/types/Collection"

export default function RecentlyAdded({ applications }) {
  const { t } = useTranslation()
  return (
    <>
      <NextSeo title={t("recently-added")} />
      <ApplicationCollection
        title={t("recently-added")}
        applications={applications}
      />
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const applications: Appstream[] = await fetchCollection(
    Collections.recentlyAdded,
  )

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      applications,
    },
    revalidate: 3600,
  }
}
