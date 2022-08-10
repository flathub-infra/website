import { GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import ApplicationCollection from "../../../src/components/application/Collection"
import fetchCollection from "../../../src/fetchers"
import { AppstreamListItem } from "../../../src/types/Appstream"
import { Collections } from "../../../src/types/Collection"

export default function PopularApps({ applications }) {
  const { t } = useTranslation()
  return (
    <>
      <NextSeo title={t("popular-apps")} />
      <div className="max-w-11/12 my-0 mx-auto w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <ApplicationCollection
          title={t("popular-apps")}
          applications={applications}
        />
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const applications: AppstreamListItem[] = await fetchCollection(
    Collections.popular,
  )

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      applications,
    },
    revalidate: 3600,
  }
}
