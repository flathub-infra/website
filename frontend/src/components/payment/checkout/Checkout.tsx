import { FunctionComponent, ReactElement, useState, useEffect } from "react"
import Spinner from "../../Spinner"
import TransactionCancelButton from "../transactions/TransactionCancelButton"
import CardSelect from "./CardSelect"
import PaymentForm from "./PaymentForm"
import TermsAgreement from "./TermsAgreement"
import { useQuery } from "@tanstack/react-query"
import { getWalletinfoWalletWalletinfoGet, Transaction } from "src/codegen"
import { useRouter } from "src/i18n/navigation"
import { useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

enum Stage {
  TermsAgreement,
  CardSelect,
  AmountInput,
}

const detailsPage = `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/payment/details`

export const TransactionCancelButtonPrep = ({
  className,
  transactionId,
  disabled = false,
}: {
  className?: string
  transactionId: string
  disabled?: boolean
}) => {
  const router = useRouter()
  return (
    <TransactionCancelButton
      id={transactionId}
      className={cn("w-full sm:w-auto", className)}
      disabled={disabled}
      onSuccess={() => router.push(`${detailsPage}/${transactionId}`)}
    />
  )
}

const Checkout: FunctionComponent<{
  transaction: Transaction
  clientSecret: string
}> = ({ transaction, clientSecret }) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { id: transactionId } = transaction.summary

  const termsStorageKey = `payment_terms_${transactionId}`

  const getInitialStage = (): Stage => {
    const stageParam = searchParams.get("stage")

    const storedTerms =
      typeof window !== "undefined"
        ? sessionStorage.getItem(termsStorageKey)
        : null

    if (transaction.summary.kind === "purchase") {
      if (stageParam === "cards" || stageParam === "payment") {
        if (storedTerms === "true") {
          return stageParam === "payment" ? Stage.AmountInput : Stage.CardSelect
        }
      }
      return Stage.TermsAgreement
    }

    if (stageParam === "payment") {
      return Stage.AmountInput
    }
    return Stage.CardSelect
  }

  const getInitialTermsAgreed = (): boolean => {
    if (transaction.summary.kind !== "purchase") {
      return true
    }

    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(termsStorageKey)
      return stored === "true"
    }
    return false
  }

  const [currentStage, setStage] = useState(getInitialStage())
  const [termsAgreed, setTermsAgreed] = useState(getInitialTermsAgreed())

  const updateStage = (newStage: Stage) => {
    setStage(newStage)

    const stageMap = {
      [Stage.TermsAgreement]: "terms",
      [Stage.CardSelect]: "cards",
      [Stage.AmountInput]: "payment",
    }

    const params = new URLSearchParams(searchParams.toString())
    params.set("stage", stageMap[newStage])
    router.replace(`?${params.toString()}`)
  }

  const agreeToTerms = () => {
    setTermsAgreed(true)
    if (typeof window !== "undefined") {
      sessionStorage.setItem(termsStorageKey, "true")
    }
  }

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        const status = transaction.summary.status
        if (status === "success" || status === "cancelled") {
          sessionStorage.removeItem(termsStorageKey)
        }
      }
    }
  }, [transaction.summary.status, termsStorageKey])

  // Cards should only be retrieved once
  const walletQuery = useQuery({
    queryKey: ["/walletinfo"],
    queryFn: async ({ signal }) => {
      const wallet = await getWalletinfoWalletWalletinfoGet({
        withCredentials: true,
        signal,
      })

      return wallet
    },
    enabled: termsAgreed,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  useEffect(() => {
    if (
      walletQuery.isSuccess &&
      walletQuery.data &&
      currentStage === Stage.CardSelect
    ) {
      const hasCards = walletQuery.data.data.cards.length > 0
      if (!hasCards) {
        updateStage(Stage.AmountInput)
      }
    }
  }, [walletQuery.isSuccess, walletQuery.data, currentStage, updateStage])

  const { data, error } = walletQuery
  const cards = data?.data.cards ?? []

  let flowContent: ReactElement
  switch (currentStage) {
    case Stage.TermsAgreement:
      flowContent = (
        <TermsAgreement
          onConfirm={agreeToTerms}
          transactionId={transactionId}
        />
      )
      break
    case Stage.CardSelect:
      flowContent = (
        <CardSelect
          transaction={transaction}
          clientSecret={clientSecret}
          walletQuery={walletQuery}
          submit={() => router.push(`${detailsPage}/${transactionId}`)}
          skip={() => updateStage(Stage.AmountInput)}
        />
      )
      break
    case Stage.AmountInput:
      flowContent = (
        <PaymentForm
          transactionId={transactionId}
          callbackPage={`${detailsPage}/${transactionId}`}
          canGoBack={cards.length > 0}
          goBack={() => updateStage(Stage.CardSelect)}
        />
      )
      break
    // Loading is a safe default rendering
    default:
      flowContent = <Spinner size="m" />
  }

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <div className="flex flex-col gap-5">{flowContent}</div>
    </div>
  )
}

export default Checkout
