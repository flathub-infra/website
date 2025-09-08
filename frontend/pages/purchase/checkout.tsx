import { GetStaticProps } from "next"
import { useTranslations } from "next-intl"

import { NextSeo } from "next-seo"
import { usePendingTransaction } from "../../src/hooks/usePendingTransaction"
import { translationMessages } from "i18n/request"

export default function Purchase() {
  const t = useTranslations()
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
      messages: await translationMessages(locale),
    },
  }
}
