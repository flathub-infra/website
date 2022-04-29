import { useTranslation } from "next-i18next"
import {
  FunctionComponent,
  ReactElement,
  useCallback,
  useEffect,
  useState,
} from "react"
import { getPaymentCards } from "../../../asyncs/payment"
import { useAsync } from "../../../hooks/useAsync"
import { PaymentCard } from "../../../types/Payment"
import Spinner from "../../Spinner"
import CardInfo from "./CardInfo"
import DeleteCardButton from "./DeleteCardButton"
import styles from "./SavedCards.module.scss"

const SavedCards: FunctionComponent = () => {
  const { t } = useTranslation()

  const [cards, setCards] = useState<PaymentCard[]>()

  // Callback ensures components aren't rerendered until data changes
  const removeCard = useCallback(
    (toRemove: PaymentCard) => {
      setCards(cards.filter((card) => card.id !== toRemove.id))
    },
    [cards],
  )

  // Saved cards fetched only when component mounts
  const { status, value, error } = useAsync(getPaymentCards)
  useEffect(() => setCards(value), [value])

  // Component considered loading until cards fetched
  if (["idle", "pending"].includes(status)) {
    return <Spinner size={100} text={t("loading-saved-payment-methods")} />
  }

  let content: ReactElement
  if (error || !cards.length) {
    content = <p>{error ? t(error) : t("no-saved-payment-methods")}</p>
  } else {
    content = (
      <div className={styles.cardList}>
        {cards.map((card) => (
          <div key={card.id}>
            <CardInfo card={card} />
            <DeleteCardButton card={card} onSuccess={removeCard} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="main-container">
      <h3>{t("saved-cards")}</h3>
      {content}
    </div>
  )
}

export default SavedCards
