"use client"

import { Elements, useStripe } from "@stripe/react-stripe-js"
import { useMutation } from "@tanstack/react-query"
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js"
import { useTranslations } from "next-intl"
import { ReactElement, useState } from "react"
import LoginGuard from "../../../../../src/components/login/LoginGuard"
import Checkout from "../../../../../src/components/payment/checkout/Checkout"
import {
  authenticatePayment,
  paymentErrorMessage,
} from "src/components/payment/checkout/stripe"
import Breadcrumbs from "../../../../../src/components/Breadcrumbs"
import Spinner from "../../../../../src/components/Spinner"
import { Button } from "@/components/ui/button"
import { useRouter } from "src/i18n/navigation"
import { useTheme } from "next-themes"
import {
  useGetTransactionByIdWalletTransactionsTxnGet,
  useGetTxnStripedataWalletTransactionsTxnStripeGet,
} from "../../../../../src/codegen"

interface Props {
  transactionId: string
  stripePublicKey: string
}

function ResumeAuthentication({
  clientSecret,
  isCurrentChallenge,
  transactionId,
  onError,
}: {
  clientSecret: string
  isCurrentChallenge: () => Promise<boolean>
  transactionId: string
  onError: (error: unknown) => Promise<void>
}) {
  const stripe = useStripe()
  const router = useRouter()
  const t = useTranslations()
  const resume = useMutation({
    mutationFn: async () => {
      if (!stripe) {
        return
      }
      if (!(await isCurrentChallenge())) {
        router.replace(`/payment/details/${transactionId}`)
        return
      }
      await authenticatePayment(stripe, clientSecret)
      router.push(`/payment/details/${transactionId}`)
    },
    onError,
  })

  return (
    <Button
      disabled={!stripe || resume.isPending}
      onClick={() => resume.mutate()}
    >
      {t("resume-payment-authentication")}
    </Button>
  )
}

export default function PaymentClient({
  transactionId,
  stripePublicKey,
}: Props) {
  const t = useTranslations()
  const [checkoutError, setCheckoutError] = useState("")
  const router = useRouter()
  const stripe = loadStripe(stripePublicKey)

  const query = useGetTransactionByIdWalletTransactionsTxnGet(transactionId, {
    axios: {
      withCredentials: true,
    },
    query: {
      enabled: !!transactionId,
      refetchOnMount: "always",
    },
  })

  const queryStripe = useGetTxnStripedataWalletTransactionsTxnStripeGet(
    transactionId,
    {
      axios: {
        withCredentials: true,
      },
      query: {
        enabled: !!transactionId,
        refetchOnMount: "always",
      },
    },
  )

  const { resolvedTheme } = useTheme()

  async function recoverCheckout(error: unknown) {
    setCheckoutError(t(paymentErrorMessage(error)))
    const fresh = await query.refetch()
    if (fresh.isError) {
      return
    }
    if (!["new", "retry"].includes(fresh.data.data.summary.status)) {
      router.replace(`/payment/details/${transactionId}`)
      return
    }
    await queryStripe.refetch()
  }

  let content: ReactElement
  if (!query.isFetchedAfterMount || !queryStripe.isFetchedAfterMount) {
    content = <Spinner size="l" />
  } else if (query.isError || queryStripe.isError) {
    content = (
      <>
        <h1 className="my-8 text-4xl font-extrabold">{t("whoops")}</h1>
        <p>
          {t(
            query.error?.message ||
              queryStripe.error?.message ||
              "Unknown error",
          )}
        </p>
      </>
    )
  } else if (queryStripe.data.data.client_secret) {
    const options: StripeElementsOptions = {
      mode: "payment",
      amount: query.data.data.summary.value,
      currency: query.data.data.summary.currency.toLowerCase(),
      paymentMethodTypes: ["card"],
      paymentMethodCreation: "manual",
      appearance: { theme: resolvedTheme === "dark" ? "night" : "stripe" },
    }

    content = (
      <Elements stripe={stripe} options={options}>
        {queryStripe.data.data.status === "requires_action" ? (
          <ResumeAuthentication
            isCurrentChallenge={async () => {
              const displayed = queryStripe.data.data
              const fresh = await queryStripe.refetch()
              return (
                fresh.isSuccess &&
                fresh.data.data.status === "requires_action" &&
                fresh.data.data.checkout_revision ===
                  displayed.checkout_revision &&
                fresh.data.data.client_secret === displayed.client_secret
              )
            }}
            clientSecret={queryStripe.data.data.client_secret}
            transactionId={transactionId}
            onError={recoverCheckout}
          />
        ) : (
          <Checkout
            onError={recoverCheckout}
            transaction={query.data.data}
            intent={queryStripe.data.data}
          />
        )}
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
        {checkoutError && <p role="alert">{checkoutError}</p>}
        {content}
      </LoginGuard>
    </div>
  )
}
