import { GetStaticPaths, GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useRouter } from "next/router"

import Collection from "../../../src/components/application/Collection"
import { fetchCategory } from "../../../src/fetchers"
import { AppstreamListItem } from "../../../src/types/Appstream"
import { Category, categoryToName } from "../../../src/types/Category"

const ApplicationCategory = ({ applications }) => {
  const { t } = useTranslation()
  const router = useRouter()
  const category = router.query.category as Category
  let title = categoryToName(category, t)

  return (
    <>
      <NextSeo title={title} />
      <div className="max-w-11/12 my-0 mx-auto w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <Collection title={title} applications={applications} />
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale, params }) => {
  const applications: AppstreamListItem[] = await fetchCategory(
    params.category as keyof typeof Category,
  )

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      applications,
    },
    revalidate: 3600,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  }
}

export default ApplicationCategory
