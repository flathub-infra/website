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
      <NextSeo title={t("checkout")} noindex />
      <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <h1 className="my-8 text-4xl font-extrabold">{t("checkout")}</h1>
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
      ...(await serverSideTranslations(locale, ["common"])),
    },
  }
}
