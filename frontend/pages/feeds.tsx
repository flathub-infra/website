import { NextSeo } from "next-seo"
import { GetStaticProps } from "next"

import Link from "next/link"
import { Button } from "@/components/ui/button"

import type { JSX } from "react"
import { useTranslations } from "next-intl"
import { translationMessages } from "i18n/request"

const Feeds = ({ locale }: { locale: string }): JSX.Element => {
  const t = useTranslations()
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
            <Link href={`${process.env.NEXT_PUBLIC_API_BASE_URI}/feed/new`}>
              {t("subscribe")}
            </Link>
          </Button>
        </div>
        <h2 className="my-4 text-xl font-semibold">{t("updated-apps")}</h2>
        <div className="flex flex-col pb-4">
          <p>{t("updated-description")}</p>
          <Button className="w-52" asChild size="xl">
            <Link
              href={`${process.env.NEXT_PUBLIC_API_BASE_URI}/feed/recently-updated`}
            >
              {t("subscribe")}
            </Link>
          </Button>
        </div>

        <h6 className="mt-2 text-xs font-normal">
          {t.rich("rss-apps", {
            link: (chunk) => (
              <Link
                className="no-underline hover:underline"
                href="/apps/search?q=rss"
              >
                {chunk}
              </Link>
            ),
          })}
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
      messages: await translationMessages(locale),
      locale,
    },
    revalidate: 900,
  }
}

export default Feeds
