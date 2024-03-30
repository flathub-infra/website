import { useStripe } from "@stripe/react-stripe-js"
import { useTranslation } from "next-i18next"
import { FunctionComponent, ReactElement, useEffect, useState } from "react"
import { TransactionDetailed } from "../../../types/Payment"
import Button from "../../Button"
import Spinner from "../../Spinner"
import CardInfo from "../cards/CardInfo"
import { handleStripeError } from "./stripe"
import { useMutation } from "@tanstack/react-query"
import { AxiosError } from "axios"
import {
  setPendingWalletTransactionsTxnSetpendingPost,
  setTransactionCardWalletTransactionsTxnSetcardPost,
} from "src/codegen"
import { PaymentCardInfo } from "src/codegen/model"

interface Props {
  transaction: TransactionDetailed
  clientSecret: string
  cards: PaymentCardInfo[]
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
  const [useCard, setUseCard] = useState<PaymentCardInfo>(null)

  const mutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await setTransactionCardWalletTransactionsTxnSetcardPost(id, useCard, {
        withCredentials: true,
      })
      return await setPendingWalletTransactionsTxnSetpendingPost(id, {
        withCredentials: true,
      })
    },
    onSuccess: async () => {
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: useCard.id,
      })

      if (result.error) {
        handleStripeError(result.error)
      } else {
        submit()
      }
    },
    onError: (err: AxiosError) => {
      setConfirmed(false)
    },
  })

  // User must confirm card selection so their intent to pay is explicit
  useEffect(() => {
    // Payment confirmation can only occur once a card is selected
    if (confirmed && !useCard) {
      setConfirmed(false)
    }

    if (stripe && useCard && confirmed) {
      mutation.mutate({ id: transaction.summary.id })
    }
  }, [
    transaction,
    confirmed,
    clientSecret,
    cards,
    submit,
    stripe,
    useCard,
    t,
    mutation,
  ])

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
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <h3 className="my-4 text-xl font-semibold">{t("saved-cards")}</h3>
      {cardSection}
      <div className="flex flex-col-reverse gap-4 sm:flex-row">
        {transactionCancelButton}
        <Button className="ms-auto w-full sm:w-auto" onClick={skip}>
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
