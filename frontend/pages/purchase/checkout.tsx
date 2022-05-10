import { GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { usePendingTransaction } from "../../src/hooks/usePendingTransaction"

export default function Purchase() {
  const { t } = useTranslation()
  const [pendingTransaction, _setPendingTransaction] = usePendingTransaction()

  return (
    <>
      <NextSeo title={t("checkout")} noindex={true} />
      <div className="main-container">
        <h1>{t("checkout")}</h1>
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
