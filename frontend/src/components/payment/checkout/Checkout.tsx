import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import { FunctionComponent, ReactElement, useEffect, useState } from "react"
import { WALLET_INFO_URL } from "../../../env"
import { PaymentCard, TransactionDetailed } from "../../../types/Payment"
import Spinner from "../../Spinner"
import TransactionCancelButton from "../transactions/TransactionCancelButton"
import CardSelect from "./CardSelect"
import styles from "./Checkout.module.scss"
import PaymentForm from "./PaymentForm"

/**
 * Performs API request to retrieve details of all cards the user has saved
 * @returns array of saved cards
 */
async function getCards() {
  let res: Response
  try {
    res = await fetch(WALLET_INFO_URL, { credentials: "include" })
  } catch {
    throw "failed-to-load-refresh"
  }

  if (res.ok) {
    // Not checking status, server only complains if not logged in (which we enforce)
    const data = await res.json()
    return data.cards
  } else {
    throw "failed-to-load-refresh"
  }
}

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
  const { t } = useTranslation()
  const router = useRouter()

  const [currentStage, setStage] = useState(Stage.Loading)
  const [cards, setCards] = useState<PaymentCard[]>(null)
  const [error, setError] = useState("")

  const { id: transactionId } = transaction.summary

  // Cards should only be retrieved once
  useEffect(() => {
    getCards()
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
