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
    return <Spinner size="m" text={t("loading-saved-payment-methods")} />
  }

  let content: ReactElement
  if (error || !cards.length) {
    content = <p>{error ? t(error) : t("no-saved-payment-methods")}</p>
  } else {
    content = (
      <div className="flex flex-row gap-5 p-5">
        {cards.map((card) => (
          <div key={card.id} className="flex flex-col items-center">
            <CardInfo card={card} />
            <DeleteCardButton card={card} onSuccess={removeCard} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-11/12 my-0 mx-auto w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <h3>{t("saved-cards")}</h3>
      {content}
    </div>
  )
}

export default SavedCards
