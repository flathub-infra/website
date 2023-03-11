import { GetStaticPaths, GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import ApplicationCollection from "../../../../../src/components/application/Collection"
import {
  fetchProjectgroupApps,
  fetchProjectgroups,
} from "../../../../../src/fetchers"
import {
  AppsIndex,
  MeilisearchResponse,
  mapAppsIndexToAppstreamListItem,
} from "src/meilisearch"

export default function Projectgroup({
  applications,
  projectgroup,
}: {
  applications: MeilisearchResponse<AppsIndex>
  projectgroup: string
}) {
  const { t } = useTranslation()
  return (
    <>
      <NextSeo title={t("applications-by-projectgroup", { projectgroup })} />
      <div className="max-w-11/12 my-0 mx-auto mt-12 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <ApplicationCollection
          title={t("applications-by-projectgroup", { projectgroup })}
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

  const applications = await fetchProjectgroupApps(
    params.projectgroup as string,
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
      projectgroup: params.projectgroup,
    },
    revalidate: 900,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  const projectgroups = await fetchProjectgroups()

  async function getCategoryAsync(projectgroup: string) {
    return {
      projectgroup: projectgroup,
      data: await fetchProjectgroupApps(projectgroup, 1, 30),
    }
  }

  const pagesByProjectgroupsPromises = projectgroups.map(getCategoryAsync)

  const pagesByProjectgroups = await Promise.all(pagesByProjectgroupsPromises)

  let paths: { params: { projectgroup: string; page?: string } }[] = []
  pagesByProjectgroups.forEach((app) => {
    for (let i = 1; i <= app.data.totalPages; i++) {
      paths.push({
        params: { projectgroup: app.projectgroup, page: i.toString() },
      })
    }
  })

  return {
    paths: paths,
    fallback: "blocking",
  }
}
