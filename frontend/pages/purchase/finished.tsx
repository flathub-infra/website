import { GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import Main from "../../src/components/layout/Main"

export default function Purchase() {
  const { t } = useTranslation()

  return (
    <Main>
      <NextSeo title={t("thank-you-for-your-purchase")} noindex={true} />
      <div className="main-container">
        <h1>{t("thank-you-for-your-purchase")}</h1>
        {t("safe-to-close-page")}
      </div>
    </Main>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  }
}
