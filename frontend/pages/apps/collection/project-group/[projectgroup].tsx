import { GetStaticPaths, GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import ApplicationCollection from "../../../../src/components/application/Collection"
import { fetchProjectgroupApps } from "../../../../src/fetchers"
import { Appstream } from "../../../../src/types/Appstream"

export default function Projectgroup({
  projectgroupApps,
  projectgroup,
}: {
  projectgroupApps: Appstream[]
  projectgroup: string
}) {
  const { t } = useTranslation()
  return (
    <>
      <NextSeo title={t("applications-by-projectgroup", { projectgroup })} />
      <ApplicationCollection
        title={t("applications-by-projectgroup", { projectgroup })}
        applications={projectgroupApps}
      />
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({
  locale,
  params: { projectgroup },
}) => {
  const projectgroupApps = await fetchProjectgroupApps(projectgroup as string)
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      projectgroupApps: projectgroupApps ?? [],
      projectgroup,
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
