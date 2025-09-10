"use client"

import { Elements } from "@stripe/react-stripe-js"
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js"
import { useTranslations } from "next-intl"
import { ReactElement } from "react"
import LoginGuard from "../../../../../src/components/login/LoginGuard"
import Checkout from "../../../../../src/components/payment/checkout/Checkout"
import Breadcrumbs from "../../../../../src/components/Breadcrumbs"
import Spinner from "../../../../../src/components/Spinner"
import { useTheme } from "next-themes"
import {
  useGetTransactionByIdWalletTransactionsTxnGet,
  useGetTxnStripedataWalletTransactionsTxnStripeGet,
} from "../../../../../src/codegen"

interface Props {
  transactionId: string
  stripePublicKey: string
}

export default function PaymentClient({
  transactionId,
  stripePublicKey,
}: Props) {
  const t = useTranslations()
  const stripe = loadStripe(stripePublicKey)

  const query = useGetTransactionByIdWalletTransactionsTxnGet(transactionId, {
    fetch: {
      credentials: "include",
    },
    query: {
      enabled: !!transactionId,
    },
  })

  const queryStripe = useGetTxnStripedataWalletTransactionsTxnStripeGet(
    transactionId,
    {
      fetch: {
        credentials: "include",
      },
      query: {
        enabled: !!transactionId,
      },
    },
  )

  const { resolvedTheme } = useTheme()

  let content: ReactElement
  if (query.isFetching || queryStripe.isFetching) {
    content = <Spinner size="l" />
  } else if (
    query.isError ||
    queryStripe.isError ||
    query.data?.status !== 200 ||
    queryStripe.data?.status !== 200
  ) {
    content = (
      <>
        <h1 className="my-8 text-4xl font-extrabold">{t("whoops")}</h1>
        <p>
          {query.error?.detail?.[0]?.msg ||
            queryStripe.error?.detail?.[0]?.msg ||
            "Unknown error"}
        </p>
      </>
    )
  } else if (queryStripe.data.data.client_secret) {
    const options: StripeElementsOptions = {
      clientSecret: queryStripe.data.data.client_secret,
      appearance: { theme: resolvedTheme === "dark" ? "night" : "stripe" },
    }

    content = (
      <Elements stripe={stripe} options={options}>
        <Checkout
          transaction={query.data.data}
          clientSecret={queryStripe.data.data.client_secret}
        />
      </Elements>
    )
  }

  const pages = [
    {
      href: "/wallet",
      name: t("user-wallet"),
      current: false,
    },
    {
      href: `/payment/${transactionId}`,
      name: t("payment"),
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
