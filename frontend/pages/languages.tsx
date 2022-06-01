import { NextSeo } from "next-seo"
import { useTranslation } from "next-i18next"
import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { getLanguageFlag, getLanguageName, languages } from "../src/localize"
import Link from "next/link"

const Languages = (): JSX.Element => {
  const { t } = useTranslation()

  return (
    <>
      <NextSeo title={t("languages")} description={t("languages-summary")} />
      <div className="my-0 mx-auto max-w-2xl">
        <h1>{t("languages")}</h1>
        <p>{t("languages-description")}</p>
        <ul className="columns-2">
          {languages.sort().map((language) => (
            <li key={language}>
              <Link href={``} locale={`${language}`} passHref>
                <a>
                  {getLanguageFlag(language) + " " + getLanguageName(language)}
                </a>
              </Link>
            </li>
          ))}
        </ul>
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
