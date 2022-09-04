import { useRouter } from "next/router"
import { FunctionComponent, ReactElement, useEffect, useState } from "react"
import { getPaymentCards } from "../../../asyncs/payment"
import { useAsync } from "../../../hooks/useAsync"
import { PaymentCard, TransactionDetailed } from "../../../types/Payment"
import Spinner from "../../Spinner"
import TransactionCancelButton from "../transactions/TransactionCancelButton"
import CardSelect from "./CardSelect"
import PaymentForm from "./PaymentForm"
import TermsAgreement from "./TermsAgreement"

interface Props {
  transaction: TransactionDetailed
  clientSecret: string
}

enum Stage {
  Loading,
  TermsAgreement,
  CardSelect,
  CardInput,
}

const detailsPage = `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/payment/details`

const Checkout: FunctionComponent<Props> = ({ transaction, clientSecret }) => {
  const router = useRouter()

  const { id: transactionId } = transaction.summary

  // For purchases the user must agree to the T&C's before continuing
  const [currentStage, setStage] = useState(
    transaction.summary.kind === "purchase"
      ? Stage.TermsAgreement
      : Stage.Loading,
  )
  const [termsAgreed, setTermsAgreed] = useState(
    transaction.summary.kind === "purchase" ? false : true,
  )

  // Cards should only be retrieved once
  const {
    value: cards,
    status,
    error,
  } = useAsync<PaymentCard[]>(getPaymentCards)

  useEffect(() => {
    if (!termsAgreed) return

    if (status === "success") {
      // User may have no saved cards to select from
      setStage(cards.length ? Stage.CardSelect : Stage.CardInput)
    }

    if (status === "error") {
      setStage(Stage.CardSelect)
    }
  }, [status, cards, termsAgreed])

  const transactionCancelButton = (
    <TransactionCancelButton
      id={transactionId}
      onSuccess={() => router.push(`${detailsPage}/${transactionId}`)}
    />
  )

  let flowContent: ReactElement
  switch (currentStage) {
    case Stage.TermsAgreement:
      flowContent = (
        <TermsAgreement
          onConfirm={() => setTermsAgreed(true)}
          transactionCancelButton={transactionCancelButton}
        />
      )
      break
    case Stage.CardSelect:
      flowContent = (
        <CardSelect
          transaction={transaction}
          clientSecret={clientSecret}
          cards={cards}
          error={error}
          submit={() => router.push(`${detailsPage}/${transactionId}`)}
          skip={() => setStage(Stage.CardInput)}
          transactionCancelButton={transactionCancelButton}
        />
      )
      break
    case Stage.CardInput:
      flowContent = (
        <PaymentForm
          transactionId={transactionId}
          callbackPage={`${detailsPage}/${transactionId}`}
          canGoBack={cards.length > 0}
          goBack={() => setStage(Stage.CardSelect)}
          transactionCancelButton={transactionCancelButton}
        />
      )
      break
    // Loading is a safe default rendering
    default:
      flowContent = <Spinner size="m" />
  }

  return (
    <div className="max-w-11/12 my-0 mx-auto w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <div className="flex flex-col gap-5">{flowContent}</div>
    </div>
  )
}

export default Checkout
