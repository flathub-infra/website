import { Elements } from "@stripe/react-stripe-js"
import { loadStripe, Stripe, StripeElementsOptions } from "@stripe/stripe-js"
import { GetStaticPaths, GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import { ReactElement, useEffect, useState } from "react"
import LoginGuard from "../../src/components/login/LoginGuard"
import Checkout from "../../src/components/payment/checkout/Checkout"
import Breadcrumbs from "../../src/components/Breadcrumbs"
import Spinner from "../../src/components/Spinner"
import { useUserContext } from "../../src/context/user-info"
import {
  STRIPE_DATA_URL,
  TRANSACTION_INFO_URL,
  TRANSACTION_STRIPE_INFO_URL,
} from "../../src/env"
import { TransactionDetailed } from "../../src/types/Payment"
import { useTheme } from "next-themes"

// Memoized Stripe object retrieval so it's only retrieved on demand
let stripePromise: Promise<Stripe>
async function getStripeObject() {
  if (!stripePromise) {
    let res: Response
    try {
      res = await fetch(STRIPE_DATA_URL)
    } catch {
      throw "network-error-try-again"
    }

    if (res.ok) {
      const stripeData = await res.json()
      stripePromise = loadStripe(stripeData.public_key)
      return stripePromise
    } else {
      throw "network-error-try-again"
    }
  } else {
    return stripePromise
  }
}

async function getTransaction(transactionId: string) {
  let res: Response
  try {
    res = await fetch(TRANSACTION_INFO_URL(transactionId), {
      credentials: "include",
    })
  } catch {
    throw "network-error-try-again"
  }

  if (res.ok) {
    const transactionData = await res.json()
    const pending = ["new", "retry"].includes(transactionData.summary.status)

    let stripeData = { client_secret: null }

    if (pending) {
      try {
        res = await fetch(TRANSACTION_STRIPE_INFO_URL(transactionId), {
          credentials: "include",
        })
      } catch {
        throw "network-error-try-again"
      }

      if (!res.ok) {
        throw "network-error-try-again"
      }

      stripeData = await res.json()
    }

    return [transactionData, stripeData.client_secret]
  } else {
    throw "network-error-try-again"
  }
}

export default function TransactionPage() {
  const { t } = useTranslation()
  const router = useRouter()

  const [stripe, setStripe] = useState<Stripe>(null)
  const [transaction, setTransaction] = useState<TransactionDetailed>(null)
  const [secret, setSecret] = useState("")
  const [error, setError] = useState("")

  const user = useUserContext()

  // Fetch the stripe object only on page mount
  useEffect(() => {
    getStripeObject().then(setStripe).catch(setError)
  }, [])

  // Once router is ready the transaction ID is attainable
  useEffect(() => {
    // Router must be ready to access query parameters
    if (!router.isReady) {
      return
    }

    // Once the transaction ID is known, the client secret is fetched
    const transaction_id = router.query.transaction_id as string

    getTransaction(transaction_id)
      .then(([transaction, secret]) => {
        setTransaction(transaction)
        setSecret(secret)
      })
      .catch(setError)
  }, [router, user])

  const { resolvedTheme } = useTheme()

  let content: ReactElement
  if (error) {
    content = (
      <>
        <h1 className="my-8 text-4xl font-extrabold">{t("whoops")}</h1>
        <p>{t(error)}</p>
      </>
    )
  } else if (secret) {
    const options: StripeElementsOptions = {
      clientSecret: secret,
      appearance: { theme: resolvedTheme === "dark" ? "night" : "stripe" },
    }

    content = (
      <Elements stripe={stripe} options={options}>
        <Checkout transaction={transaction} clientSecret={secret} />
      </Elements>
    )
  } else {
    content = <Spinner size="l" />
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
      <NextSeo title={t("payment")} noindex={true}></NextSeo>
      <div className="max-w-11/12 mx-auto my-0 w-11/12 pt-4 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <LoginGuard>
          <Breadcrumbs pages={pages} />
          {content}
        </LoginGuard>
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

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  }
}
