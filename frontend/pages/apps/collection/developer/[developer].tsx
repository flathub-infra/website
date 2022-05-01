import { GetStaticPaths, GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import ApplicationCollection from "../../../../src/components/application/Collection"
import { fetchDeveloperApps } from "../../../../src/fetchers"
import { DesktopAppstream } from "../../../../src/types/Appstream"

export default function Developer({
  developerApps,
  developer,
}: {
  developerApps: DesktopAppstream[]
  developer: string
}) {
  const { t } = useTranslation()
  return (
    <>
      <NextSeo title={t("applications-by-developer", { developer })} />
      <ApplicationCollection
        title={t("applications-by-developer", { developer })}
        applications={developerApps}
      />
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({
  locale,
  params: { developer },
}) => {
  const developerApps = await fetchDeveloperApps(developer as string)
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      developerApps: developerApps ?? [],
      developer,
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
