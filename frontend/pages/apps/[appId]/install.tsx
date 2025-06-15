import { GetStaticPaths, GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"

import { NextSeo } from "next-seo"
import { Trans, useTranslation } from "next-i18next"
import Head from "next/head"
import { fetchAppstream } from "src/fetchers"
import { Appstream } from "src/types/Appstream"

export default function Details({ app }: { app: Appstream }) {
  const { t } = useTranslation()

  return (
    <>
      <NextSeo title={t("download.download-x", { x: app.name })} noindex />
      <Head>
        <meta
          httpEquiv="refresh"
          content={`0; url=/apps/${app.id}/flatpakhttps`}
        />
      </Head>
      <div className="flex max-w-full flex-col">
        <section className={`flex flex-col px-[5%] md:px-[20%] 2xl:px-[30%]`}>
          <div>
            <h1 className="mt-8 mb-6 text-4xl font-extrabold">
              {t("download.download-x", { x: app.name })}
            </h1>
            <Trans i18nKey={"common:download.fallback-instructions"}>
              <div className="mb-8">
                You can now switch to your systems native package manager.
              </div>
              <div className="mb-4">
                If it did not notify you, you can do the following, as your
                system does not support <i>flatpak+https</i> urls:
              </div>
              <ol className="list-decimal list-inside pl-4">
                <li>
                  Download the{" "}
                  <a
                    href={`https://dl.flathub.org/repo/appstream/${app.id}.flatpakref`}
                  >
                    .flatpakref file
                  </a>
                </li>
                <li>Run it from your file manager</li>
              </ol>
            </Trans>
          </div>
        </section>
      </div>
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
