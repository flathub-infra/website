import { Elements } from "@stripe/react-stripe-js"
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js"
import { GetStaticPaths, GetStaticProps } from "next"
import { useTranslations } from "next-intl"

import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import { ReactElement } from "react"
import LoginGuard from "../../src/components/login/LoginGuard"
import Checkout from "../../src/components/payment/checkout/Checkout"
import Breadcrumbs from "../../src/components/Breadcrumbs"
import Spinner from "../../src/components/Spinner"
import { useTheme } from "next-themes"
import {
  getStripedataWalletStripedataGet,
  useGetTransactionByIdWalletTransactionsTxnGet,
  useGetTxnStripedataWalletTransactionsTxnStripeGet,
} from "src/codegen"
import { translationMessages } from "i18n/request"

export default function TransactionPage({ stripePublicKey }) {
  const t = useTranslations()
  const router = useRouter()

  const stripe = loadStripe(stripePublicKey)

  const query = useGetTransactionByIdWalletTransactionsTxnGet(
    router.query.transaction_id as string,
    {
      axios: {
        withCredentials: true,
      },
      query: {
        enabled: !!router.query.transaction_id,
      },
    },
  )

  const queryStripe = useGetTxnStripedataWalletTransactionsTxnStripeGet(
    router.query.transaction_id as string,
    {
      axios: {
        withCredentials: true,
      },
      query: {
        enabled: !!router.query.transaction_id,
      },
    },
  )

  const { resolvedTheme } = useTheme()

  let content: ReactElement
  if (query.isFetching || queryStripe.isFetching) {
    content = <Spinner size="l" />
  } else if (query.isError || queryStripe.isError) {
    content = (
      <>
        <h1 className="my-8 text-4xl font-extrabold">{t("whoops")}</h1>
        <p>{t(query.error.message || queryStripe.error.message)}</p>
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
      href: `/payment/${router.query.transaction_id}`,
      name: t("payment"),
      current: true,
    },
  ]

  return (
    <>
      <NextSeo title={t("payment")} noindex />
      <div className="max-w-11/12 mx-auto my-0 w-11/12 pt-4 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <LoginGuard>
          <Breadcrumbs pages={pages} />
          {content}
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
  const stripeDataQuery = await getStripedataWalletStripedataGet()

  return {
    props: {
      stripePublicKey: stripeDataQuery.data.public_key,
      messages: await translationMessages(locale),
    },
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  }
}
