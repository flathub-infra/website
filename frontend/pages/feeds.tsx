import { FEED_NEW_URL, FEED_RECENTLY_UPDATED_URL } from "../src/env"
import { NextSeo } from "next-seo"
import { Trans, useTranslation } from "next-i18next"
import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import Link from "next/link"
import { Button } from "@/components/ui/button"

import type { JSX } from "react"

const Feeds = ({ locale }: { locale: string }): JSX.Element => {
  const { t } = useTranslation()
  return (
    <>
      <NextSeo
        title={t("rss-feeds")}
        description={t("rss-description")}
        openGraph={{
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/feeds`,
        }}
        noindex={locale === "en-GB"}
      />
      <div className="max-w-11/12 sm:w-max-1/2 mx-auto my-0 mt-12 w-11/12 sm:w-1/2 2xl:w-[900px] 2xl:max-w-[900px]">
        <h1 className="mb-8 text-4xl font-extrabold">{t("rss-feeds")}</h1>
        <p>{t("rss-feeds-description")}</p>
        <h2 className="my-4 text-xl font-semibold">{t("new-apps")}</h2>
        <div className="flex flex-col pb-4">
          <p>{t("new-description")}</p>
          <Button className="w-52" asChild size="xl">
            <Link href={FEED_NEW_URL}>{t("subscribe")}</Link>
          </Button>
        </div>
        <h2 className="my-4 text-xl font-semibold">{t("updated-apps")}</h2>
        <div className="flex flex-col pb-4">
          <p>{t("updated-description")}</p>
          <Button className="w-52" asChild size="xl">
            <Link href={FEED_RECENTLY_UPDATED_URL}>{t("subscribe")}</Link>
          </Button>
        </div>

        <h6 className="mt-2 text-xs font-normal">
          <Trans i18nKey={"common:rss-apps"}>
            Do you need an RSS application? We have excellent ones in Flathub.
            Find them{" "}
            <Link
              className="no-underline hover:underline"
              href="/apps/search?q=rss"
            >
              here
            </Link>
          </Trans>
        </h6>
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({
  locale,
}: {
  locale: string
}) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      locale,
    },
    revalidate: 900,
  }
}

export default Feeds
