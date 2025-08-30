import { FunctionComponent, ReactElement, useState } from "react"
import Spinner from "../../Spinner"
import TransactionCancelButton from "../transactions/TransactionCancelButton"
import CardSelect from "./CardSelect"
import PaymentForm from "./PaymentForm"
import TermsAgreement from "./TermsAgreement"
import { useQuery } from "@tanstack/react-query"
import { getWalletinfoWalletWalletinfoGet, Transaction } from "src/codegen"
import { useRouter } from "src/i18n/navigation"
import { useLocale } from "next-intl"

enum Stage {
  TermsAgreement,
  CardSelect,
  AmountInput,
}

const detailsPage = `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/payment/details`

export const TransactionCancelButtonPrep = ({
  transactionId,
  disabled = false,
}: {
  transactionId: string
  disabled?: boolean
}) => {
  const router = useRouter()
  const locale = useLocale()
  return (
    <TransactionCancelButton
      id={transactionId}
      className="w-full sm:w-auto"
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

  // For purchases the user must agree to the T&C's before continuing
  const [currentStage, setStage] = useState(
    transaction.summary.kind === "purchase"
      ? Stage.TermsAgreement
      : Stage.CardSelect,
  )
  const [termsAgreed, setTermsAgreed] = useState(
    transaction.summary.kind === "purchase" ? false : true,
  )

  // Cards should only be retrieved once
  const walletQuery = useQuery({
    queryKey: ["/walletinfo"],
    queryFn: async ({ signal }) => {
      const wallet = await getWalletinfoWalletWalletinfoGet({
        withCredentials: true,
        signal,
      })

      // User may have no saved cards to select from
      setStage(
        wallet.data.cards.length > 0 ? Stage.CardSelect : Stage.AmountInput,
      )

      return wallet
    },
    enabled: termsAgreed,
  })

  const { id: transactionId } = transaction.summary

  const { data, error } = walletQuery
  const cards = data?.data.cards ?? []

  let flowContent: ReactElement
  switch (currentStage) {
    case Stage.TermsAgreement:
      flowContent = (
        <TermsAgreement
          onConfirm={() => setTermsAgreed(true)}
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
          skip={() => setStage(Stage.AmountInput)}
        />
      )
      break
    case Stage.AmountInput:
      flowContent = (
        <PaymentForm
          transactionId={transactionId}
          callbackPage={`${detailsPage}/${transactionId}`}
          canGoBack={cards.length > 0}
          goBack={() => setStage(Stage.CardSelect)}
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
