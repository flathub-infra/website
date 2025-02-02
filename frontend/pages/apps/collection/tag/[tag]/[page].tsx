import { GetStaticPaths, GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import ApplicationCollection from "../../../../../src/components/application/Collection"
import {
  AppsIndex,
  MeilisearchResponse,
  mapAppsIndexToAppstreamListItem,
} from "src/meilisearch"
import { getKeywordKeywordGet } from "src/codegen"
import { AxiosResponse } from "axios"

export default function Tag({
  applications,
  tag: tag,
  locale,
}: {
  applications: MeilisearchResponse<AppsIndex>
  tag: string
  locale: string
}) {
  const { t } = useTranslation()
  return (
    <>
      <NextSeo
        title={t("apps-by-tag", { tag: tag })}
        openGraph={{
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps/collection/tag/${tag}`,
        }}
        noindex={locale === "en-GB"}
      />
      <div className="max-w-11/12 mx-auto my-0 mt-12 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <ApplicationCollection
          title={t("apps-by-tag", { tag: tag })}
          applications={applications.hits.map(mapAppsIndexToAppstreamListItem)}
          page={applications.page}
          totalPages={applications.totalPages}
          totalHits={applications.totalHits}
        />
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale, params }) => {
  if (isNaN(params.page as unknown as number)) {
    return {
      notFound: true,
      revalidate: 60,
    }
  }

  const applications = (await getKeywordKeywordGet({
    keyword: params.tag as string,
    locale: locale,
    page: params.page as unknown as number,
    per_page: 30,
  })) as AxiosResponse<MeilisearchResponse<AppsIndex>>

  if (applications.data.page > applications.data.totalPages) {
    return {
      notFound: true,
      revalidate: 60,
    }
  }

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      applications: applications.data,
      tag: params.tag,
      locale,
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
