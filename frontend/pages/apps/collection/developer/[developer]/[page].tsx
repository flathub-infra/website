import { GetStaticPaths, GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import ApplicationCollection from "../../../../../src/components/application/Collection"
import {
  fetchDeveloperApps,
  fetchDevelopers,
} from "../../../../../src/fetchers"
import {
  AppsIndex,
  MeilisearchResponse,
  mapAppsIndexToAppstreamListItem,
} from "src/meilisearch"

export default function Developer({
  applications,
  developer,
}: {
  applications: MeilisearchResponse<AppsIndex>
  developer: string
}) {
  const { t } = useTranslation()
  return (
    <>
      <NextSeo
        title={t("apps-by-developer", { developer })}
        openGraph={{
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps/collection/developer/${developer}`,
        }}
      />
      <div className="max-w-11/12 mx-auto my-0 mt-12 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <ApplicationCollection
          title={t("apps-by-developer", { developer })}
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
    }
  }

  const applications = await fetchDeveloperApps(
    params.developer as string,
    params.page as unknown as number,
    30,
  )

  if (applications.page > applications.totalPages) {
    return {
      notFound: true,
    }
  }

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      applications,
      developer: params.developer,
    },
    revalidate: 900,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  const developers = await fetchDevelopers()

  async function getDeveloperAsync(developer: string) {
    return {
      developer: developer,
      data: await fetchDeveloperApps(developer, 1, 30),
    }
  }

  const pagesByDevelopersPromises = developers.map(getDeveloperAsync)

  const pagesByDevelopers = await Promise.all(pagesByDevelopersPromises)

  let paths: { params: { developer: string; page?: string } }[] = []
  pagesByDevelopers.forEach((app) => {
    for (let i = 1; i <= app.data.totalPages; i++) {
      paths.push({
        params: { developer: app.developer, page: i.toString() },
      })
    }
  })

  return {
    paths: paths,
    fallback: "blocking",
  }
}
