import { useStripe } from "@stripe/react-stripe-js"
import { useTranslations } from "next-intl"
import { FunctionComponent, ReactElement, useState } from "react"
import { CardInfo, CardInfoSkeleton } from "../cards/CardInfo"
import { handleStripeError } from "./stripe"
import { useMutation, UseQueryResult } from "@tanstack/react-query"
import { AxiosError, AxiosResponse } from "axios"
import {
  setPendingWalletTransactionsTxnSetpendingPost,
  setTransactionCardWalletTransactionsTxnSetcardPost,
} from "src/codegen"
import { PaymentCardInfo, Transaction, WalletInfo } from "src/codegen/model"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { TransactionCancelButtonPrep } from "./Checkout"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface Props {
  transaction: Transaction
  clientSecret: string
  submit: () => void
  skip: () => void
  walletQuery: UseQueryResult<AxiosResponse<WalletInfo, any>, Error>
}

const CardSelect: FunctionComponent<Props> = ({
  transaction,
  clientSecret,
  submit,
  skip,
  walletQuery,
}) => {
  const t = useTranslations()
  const stripe = useStripe()

  const error = walletQuery.isError ? "failed-to-load-refresh" : null

  const cards = walletQuery?.data?.data.cards ?? []

  const [useCard, setUseCard] = useState<PaymentCardInfo | null>(
    cards[0] ?? null,
  )

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
  } else if (walletQuery.isPending) {
    cardSection = (
      <div className="flex flex-row gap-5">
        <RadioGroup className="flex items-center space-x-2">
          <RadioGroupItem value={""} />
          <CardInfoSkeleton />
        </RadioGroup>
      </div>
    )
  } else if (cards) {
    cardSection = (
      <RadioGroup value={useCard?.id} className="flex flex-row gap-5">
        {cards.map((card) => {
          return (
            <div className="flex items-center space-x-2" key={card.id}>
              <RadioGroupItem value={card.id} id={card.id} />
              <CardInfo
                key={card.id}
                card={card}
                onClick={() => setUseCard(card)}
                className={
                  useCard &&
                  card.id === useCard.id &&
                  "border border-flathub-celestial-blue dark:border-flathub-celestial-blue"
                }
              />
            </div>
          )
        })}
      </RadioGroup>
    )
  }

  // Should always present the option to use a new card in case user
  // doesn't want to wait for a slow network
  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px] flex gap-4 flex-col">
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
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          )}
          {t("confirm-selection")}
        </Button>
      </div>
    </div>
  )
}

export default CardSelect
