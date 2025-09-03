"use client"

import { useTranslations } from "next-intl"
import { ReactElement } from "react"
import Breadcrumbs from "../../../../../../src/components/Breadcrumbs"
import TransactionDetails from "../../../../../../src/components/payment/transactions/TransactionDetails"
import Spinner from "../../../../../../src/components/Spinner"
import LoginGuard from "../../../../../../src/components/login/LoginGuard"
import { useGetTransactionByIdWalletTransactionsTxnGet } from "../../../../../../src/codegen"

interface Props {
  transactionId: string
}

export default function PaymentDetailsClient({ transactionId }: Props) {
  const t = useTranslations()

  const query = useGetTransactionByIdWalletTransactionsTxnGet(transactionId, {
    axios: {
      withCredentials: true,
    },
    query: {
      enabled: !!transactionId,
    },
  })

  let content: ReactElement

  if (query.isFetching) {
    content = <Spinner size="l" />
  } else if (query.isError) {
    content = (
      <>
        <h1 className="my-8 text-4xl font-extrabold">{t("whoops")}</h1>
        <p>{t(query.error?.message || "Unknown error")}</p>
      </>
    )
  } else {
    content = <TransactionDetails transaction={query.data.data} />
  }

  const pages = [
    {
      href: "/wallet",
      name: t("user-wallet"),
      current: false,
    },
    {
      href: `/payment/details/${transactionId}`,
      name: t("transaction-summary"),
      current: true,
    },
  ]

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 pt-4 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <LoginGuard>
        <Breadcrumbs pages={pages} />
        {content}
      </LoginGuard>
    </div>
  )
}
