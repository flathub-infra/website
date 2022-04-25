import { useRouter } from "next/router"
import { FunctionComponent, ReactElement, useEffect, useState } from "react"
import { getPaymentCards } from "../../../asyncs/payment"
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

  const [currentStage, setStage] = useState(Stage.Loading)
  const [cards, setCards] = useState<PaymentCard[]>(null)
  const [error, setError] = useState("")

  const { id: transactionId } = transaction.summary

  // Cards should only be retrieved once
  useEffect(() => {
    getPaymentCards()
      .then((data) => {
        // User may have no saved cards to select from
        if (data.length) {
          setCards(data)
          setStage(Stage.CardSelect)
        } else {
          setStage(Stage.CardInput)
        }
      })
      .catch((err) => {
        setError(err)
        setStage(Stage.CardSelect)
      })
  }, [])

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
        />
      )
      break
    // Loading is a safe default rendering
    default:
      flowContent = <Spinner size={100} />
  }

  return (
    <div className="main-container">
      <div className={styles.checkout}>
        {flowContent}
        <div className="actions">
          <TransactionCancelButton
            id={transactionId}
            onSuccess={() => router.push(`${detailsPage}/${transactionId}`)}
          />
        </div>
      </div>
    </div>
  )
}

export default Checkout
