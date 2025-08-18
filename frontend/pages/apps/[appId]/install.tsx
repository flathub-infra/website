import { GetStaticPaths, GetStaticProps } from "next"

import { NextSeo } from "next-seo"
import Head from "next/head"
import { fetchAppstream } from "src/fetchers"
import { Appstream } from "src/types/Appstream"
import InstallFallback from "src/components/application/InstallFallback"
import { useTranslations } from "next-intl"
import { translationMessages } from "i18n/request"

export default function Install({
  app,
}: {
  app: Pick<Appstream, "id" | "name" | "icon">
}) {
  const t = useTranslations()

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
      messages: await translationMessages(locale),
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
