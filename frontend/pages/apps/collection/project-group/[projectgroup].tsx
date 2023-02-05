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
      <div className="max-w-11/12 my-0 mx-auto w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <ApplicationCollection
          title={t("applications-by-projectgroup", { projectgroup })}
          applications={projectgroupApps}
        />
      </div>
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
    revalidate: 900,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  }
}
