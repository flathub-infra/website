import { GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"

export default function Purchase() {
  const { t } = useTranslation()

  return (
    <>
      <NextSeo title={t("thank-you-for-your-purchase")} noindex={true} />
      <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <h1 className="my-8 text-4xl font-extrabold">
          {t("thank-you-for-your-purchase")}
        </h1>
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
