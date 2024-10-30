import { useStripe } from "@stripe/react-stripe-js"
import { useTranslation } from "next-i18next"
import { FunctionComponent, ReactElement, useState } from "react"
import Spinner from "../../Spinner"
import CardInfo from "../cards/CardInfo"
import { handleStripeError } from "./stripe"
import { useMutation } from "@tanstack/react-query"
import { AxiosError } from "axios"
import {
  setPendingWalletTransactionsTxnSetpendingPost,
  setTransactionCardWalletTransactionsTxnSetcardPost,
} from "src/codegen"
import { PaymentCardInfo, Transaction } from "src/codegen/model"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { TransactionCancelButtonPrep } from "./Checkout"

interface Props {
  transaction: Transaction
  clientSecret: string
  cards: PaymentCardInfo[]
  error: string | null
  submit: () => void
  skip: () => void
}

const CardSelect: FunctionComponent<Props> = ({
  transaction,
  clientSecret,
  cards,
  error,
  submit,
  skip,
}) => {
  const { t } = useTranslation()
  const stripe = useStripe()

  const [useCard, setUseCard] = useState<PaymentCardInfo | null>(null)

  const mutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (!useCard) return

      await setTransactionCardWalletTransactionsTxnSetcardPost(id, useCard, {
        withCredentials: true,
      })
      return await setPendingWalletTransactionsTxnSetpendingPost(id, {
        withCredentials: true,
      })
    },
    onSuccess: async () => {
      if (!stripe) return

      if (!useCard) return

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: useCard.id,
      })

      if (result.error) {
        handleStripeError(result.error)
      } else {
        submit()
      }
    },
    onError: (err: AxiosError) => {},
  })

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
        <TransactionCancelButtonPrep
          transactionId={transaction.summary.id}
          disabled={mutation.isPending}
        />

        <Button
          size="lg"
          className="ms-auto w-full sm:w-auto"
          onClick={skip}
          disabled={mutation.isPending}
        >
          {t("use-new-card")}
        </Button>
        <Button
          size="lg"
          className="w-full sm:w-auto"
          onClick={() => {
            if (stripe && useCard) {
              mutation.mutate({ id: transaction.summary.id })
            }
          }}
          disabled={!useCard || mutation.isPending}
        >
          {mutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {t("confirm-selection")}
        </Button>
      </div>
    </div>
  )
}

export default CardSelect
