import { useStripe } from "@stripe/react-stripe-js"
import { useTranslation } from "next-i18next"
import { FunctionComponent, ReactElement, useEffect, useState } from "react"
import { toast } from "react-toastify"
import {
  setTransactionPending,
  setTransactionUseCard,
} from "../../../asyncs/payment"
import { PaymentCard, TransactionDetailed } from "../../../types/Payment"
import Button from "../../Button"
import Spinner from "../../Spinner"
import CardInfo from "../cards/CardInfo"
import { handleStripeError } from "./stripe"

interface Props {
  transaction: TransactionDetailed
  clientSecret: string
  cards: PaymentCard[]
  error: string
  submit: () => void
  skip: () => void
  transactionCancelButton: ReactElement
}

const CardSelect: FunctionComponent<Props> = ({
  transaction,
  clientSecret,
  cards,
  error,
  submit,
  skip,
  transactionCancelButton,
}) => {
  const { t } = useTranslation()
  const stripe = useStripe()

  const [confirmed, setConfirmed] = useState(false)
  const [useCard, setUseCard] = useState<PaymentCard>(null)

  // User must confirm card selection so their intent to pay is explicit
  useEffect(() => {
    async function onConfirm() {
      const { id } = transaction.summary

      setTransactionUseCard(id, useCard)
        .then(() => setTransactionPending(id))
        .then(async () => {
          const result = await stripe.confirmCardPayment(clientSecret, {
            payment_method: useCard.id,
          })

          if (result.error) {
            handleStripeError(result.error)
          } else {
            submit()
          }
        })
        .catch((err) => {
          toast.error(t(err))
          setConfirmed(false)
        })
    }

    // Payment confirmation can only occur once a card is selected
    if (confirmed && !useCard) {
      setConfirmed(false)
    }

    if (stripe && useCard && confirmed) {
      onConfirm()
    }
  }, [transaction, confirmed, clientSecret, cards, submit, stripe, useCard, t])

  let cardSection: ReactElement
  if (error) {
    cardSection = <p>{t(error)}</p>
  } else if (cards) {
    const cardElems = cards.map((card) => {
      return (
        <CardInfo
          key={card.id}
          card={card}
          onClick={() => setUseCard(card)}
          className={
            useCard && card.id === useCard.id
              ? "border border-flathub-celestial-blue dark:border-flathub-celestial-blue"
              : ""
          }
        />
      )
    })

    cardSection = <div className="flex flex-row gap-5 p-5">{cardElems}</div>
  } else {
    cardSection = <Spinner size="m" text={t("loading-saved-payment-methods")} />
  }

  // Should always present the option to use a new card in case user
  // doesn't want to wait for a slow network
  return (
    <div className="max-w-11/12 my-0 mx-auto w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <h3>{t("saved-cards")}</h3>
      {cardSection}
      <div className="flex flex-col-reverse gap-4 sm:flex-row">
        {transactionCancelButton}
        <Button className="ml-auto w-full sm:w-auto" onClick={skip}>
          {t("use-new-card")}
        </Button>
        <Button
          className="w-full sm:w-auto"
          onClick={() => setConfirmed(true)}
          disabled={!useCard}
        >
          {t("confirm-selection")}
        </Button>
      </div>
    </div>
  )
}

export default CardSelect
