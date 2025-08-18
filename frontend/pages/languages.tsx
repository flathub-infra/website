import { NextSeo } from "next-seo"
import { GetStaticProps } from "next"

import { getLanguageFlag, getLanguageName, languages } from "../src/localize"
import Link from "next/link"

import type { JSX } from "react"
import { useTranslations } from "next-intl"
import { translationMessages } from "i18n/request"

const Languages = ({ locale }: { locale: string }): JSX.Element => {
  const t = useTranslations()

  return (
    <>
      <NextSeo
        title={t("languages")}
        description={t("languages-summary")}
        openGraph={{
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/languages`,
        }}
        noindex={locale === "en-GB"}
      />
      <div className="max-w-11/12 sm:w-max-1/2 mx-auto my-0 mt-12 w-11/12 sm:w-1/2 2xl:w-[900px] 2xl:max-w-[900px]">
        <h1 className="mb-8 text-4xl font-extrabold">{t("languages")}</h1>
        <p>{t("languages-description")}</p>
        <ul className="columns-1 space-y-2 text-lg sm:columns-2 sm:gap-0 sm:space-y-0 sm:text-base 2xl:columns-3">
          {languages
            .sort((a, b) =>
              getLanguageName(a).localeCompare(getLanguageName(b)),
            )
            .map((language) => (
              <li key={language}>
                <Link
                  className="no-underline hover:underline"
                  href={``}
                  locale={`${language}`}
                  passHref
                >
                  {getLanguageFlag(language) + " " + getLanguageName(language)}
                </Link>
              </li>
            ))}
        </ul>
        <p className="pt-8">
          {t.rich("contribute-languages", {
            t: (chunks) => (
              <a
                target="_blank"
                rel="noreferrer"
                className="no-underline hover:underline"
                href="https://hosted.weblate.org/engage/flathub/"
              >
                {chunks}
              </a>
            ),
          })}
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
      messages: await translationMessages(locale),
      locale,
    },
    revalidate: 900,
  }
}

export default Languages
