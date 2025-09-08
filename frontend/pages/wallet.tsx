import { GetStaticProps } from "next"
import { useTranslations } from "next-intl"

import { NextSeo } from "next-seo"
import LoginGuard from "../src/components/login/LoginGuard"
import SavedCards from "../src/components/payment/cards/SavedCards"
import TransactionHistory from "../src/components/payment/transactions/TransactionHistory"
import { translationMessages } from "i18n/request"

// This is a proof of concept page, ideally this information will be
// integrated into the user page as a tab or similar
export default function Wallet() {
  const t = useTranslations()

  return (
    <>
      <NextSeo title={t("user-wallet")} noindex />
      <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <h1 className="pt-12 text-4xl font-extrabold">{t("user-wallet")}</h1>
        <LoginGuard>
          <SavedCards />
          <TransactionHistory />
        </LoginGuard>
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
