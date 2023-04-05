import { NextSeo } from "next-seo"
import { Trans, useTranslation } from "next-i18next"
import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { getLanguageFlag, getLanguageName, languages } from "../src/localize"
import Link from "next/link"

const Languages = (): JSX.Element => {
  const { t } = useTranslation()

  return (
    <>
      <NextSeo title={t("languages")} description={t("languages-summary")} />
      <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <h1 className="my-8">{t("languages")}</h1>
        <p>{t("languages-description")}</p>
        <ul className="columns-1 sm:columns-2">
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
          <Trans i18nKey={"common:contribute-languages"}>
            All these translations have been contributed by the community. If
            you want to help translate Flathub, please
            <a
              target="_blank"
              rel="noreferrer"
              className="no-underline hover:underline"
              href="https://hosted.weblate.org/engage/flathub/"
            >
              join the Flathub translation team
            </a>
            .
          </Trans>
        </p>
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  }
}

export default Languages
