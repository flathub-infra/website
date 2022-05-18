import { useRouter } from "next/router"
import { FunctionComponent, ReactElement, useEffect, useState } from "react"
import { getPaymentCards } from "../../../asyncs/payment"
import { useAsync } from "../../../hooks/useAsync"
import { PaymentCard, TransactionDetailed } from "../../../types/Payment"
import Spinner from "../../Spinner"
import TransactionCancelButton from "../transactions/TransactionCancelButton"
import CardSelect from "./CardSelect"
import styles from "./Checkout.module.scss"
import PaymentForm from "./PaymentForm"

interface Props {
  transaction: TransactionDetailed
  clientSecret: string
}

enum Stage {
  Loading,
  CardSelect,
  CardInput,
}

const detailsPage = `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/payment/details`

const Checkout: FunctionComponent<Props> = ({ transaction, clientSecret }) => {
  const router = useRouter()

  const { id: transactionId } = transaction.summary

  const [currentStage, setStage] = useState(Stage.Loading)

  // Cards should only be retrieved once
  const {
    value: cards,
    status,
    error,
  } = useAsync<PaymentCard[]>(getPaymentCards)

  useEffect(() => {
    if (status === "success") {
      // User may have no saved cards to select from
      if (cards.length) {
        setStage(Stage.CardSelect)
      } else {
        setStage(Stage.CardInput)
      }
    }

    if (status === "error") {
      setStage(Stage.CardSelect)
    }
  }, [status, cards])

  let flowContent: ReactElement
  switch (currentStage) {
    case Stage.CardSelect:
      flowContent = (
        <CardSelect
          transaction={transaction}
          clientSecret={clientSecret}
          cards={cards}
          error={error}
          submit={() => router.push(`${detailsPage}/${transactionId}`)}
          skip={() => setStage(Stage.CardInput)}
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
        />
      )
      break
    // Loading is a safe default rendering
    default:
      flowContent = <Spinner size={100} />
  }

  return (
    <div className={styles.checkout}>
      {flowContent}
      <div className="actions">
        <TransactionCancelButton
          id={transactionId}
          onSuccess={() => router.push(`${detailsPage}/${transactionId}`)}
        />
      </div>
    </div>
  )
}

export default Checkout
