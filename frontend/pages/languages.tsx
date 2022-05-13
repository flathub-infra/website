import { NextSeo } from "next-seo"
import { useTranslation } from "next-i18next"
import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { getLanguageName, languages } from "../src/localize"
import Link from "next/link"

const Languages = (): JSX.Element => {
  const { t } = useTranslation()

  return (
    <>
      <NextSeo title={t("languages")} description={t("languages-summary")} />
      <div className="main-container" style={{ maxWidth: 600 }}>
        <h1>{t("languages")}</h1>
        <p>{t("languages-description")}</p>
        <ul style={{ columns: 2 }}>
          {languages.sort().map((language) => (
            <li key={language}>
              <Link href={``} locale={`${language}`}>
                {getLanguageName(language)}
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
