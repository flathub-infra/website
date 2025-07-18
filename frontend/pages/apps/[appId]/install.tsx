import { GetStaticPaths, GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"

import { NextSeo } from "next-seo"
import { useTranslation } from "next-i18next"
import Head from "next/head"
import { fetchAppstream } from "src/fetchers"
import { Appstream } from "src/types/Appstream"
import InstallFallback from "src/components/application/InstallFallback"

export default function Install({
  app,
}: {
  app: Pick<Appstream, "id" | "name" | "icon">
}) {
  const { t } = useTranslation()

  return (
    <>
      <NextSeo title={t("download.install-x", { x: app.name })} noindex />
      <Head>
        <meta
          httpEquiv="refresh"
          content={`0; url=/apps/${app.id}/flatpakhttps`}
        />
      </Head>
      <InstallFallback app={app} />
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({
  locale,
  params: { appId: appId },
}: {
  locale: string
  defaultLocale: string
  params: { appId: string }
}) => {
  const app = await fetchAppstream(appId as string, locale)

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      app,
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
