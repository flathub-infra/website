import { GetStaticProps } from "next"
import { Trans } from "next-i18next"

import { useTranslations } from "next-intl"
import { NextSeo } from "next-seo"

export default function Custom500() {
  const t = useTranslations()
  return (
    <>
      <NextSeo
        title={t("server-error")}
        openGraph={{
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/500`,
        }}
        noindex
      />
      <div className="max-w-11/12 sm:w-max-1/2 mx-auto my-0 mt-12 w-11/12 sm:w-1/2 2xl:w-[900px] 2xl:max-w-[900px]">
        <h1 className="mb-8 text-4xl font-extrabold">{t("whoops")}</h1>
        <p>{t("an-error-occurred-server", { errorCode: "500" })}</p>
        <p>
          <Trans i18nKey={"common:retry-or-go-home"}>
            You might want to retry or go back{" "}
            <a className="no-underline hover:underline" href=".">
              home
            </a>
            .
          </Trans>
        </p>
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
      messages: (await import(`../public/locales/${locale}/common.json`))
        .default,
    },
  }
}
