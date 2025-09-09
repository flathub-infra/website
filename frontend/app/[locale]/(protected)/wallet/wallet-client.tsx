"use client"

import { useTranslations } from "next-intl"
import SavedCards from "../../../../src/components/payment/cards/SavedCards"
import TransactionHistory from "../../../../src/components/payment/transactions/TransactionHistory"
import type { JSX } from "react"

const WalletClient = (): JSX.Element => {
  const t = useTranslations()

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <h1 className="pt-12 text-4xl font-extrabold">{t("user-wallet")}</h1>
      <SavedCards />
      <TransactionHistory />
    </div>
  )
}

export default WalletClient
