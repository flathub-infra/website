import { GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"

export default function Purchase() {
  const { t } = useTranslation()

  return (
    <>
      <NextSeo title={t("thank-you-for-your-purchase")} noindex={true} />
      <div className="main-container">
        <h1>{t("thank-you-for-your-purchase")}</h1>
        {t("safe-to-close-page")}
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
