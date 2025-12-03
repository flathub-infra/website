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

  const [isProcessing, setIsProcessing] = useState(false)

  const mutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (!useCard) return

      setIsProcessing(true)

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
        setIsProcessing(false)
      } else {
        submit()
      }
    },
    onError: (err: AxiosError) => {
      setIsProcessing(false)
    },
  })

  let cardSection: ReactElement
  if (error) {
    cardSection = <p>{t(error)}</p>
  } else if (walletQuery.isPending) {
    cardSection = (
      <div className="flex flex-wrap gap-4">
        <CardInfoSkeleton />
        <CardInfoSkeleton />
      </div>
    )
  } else if (cards) {
    cardSection = (
      <RadioGroup value={useCard?.id} className="flex flex-wrap gap-4">
        {cards.map((card) => {
          const isSelected = useCard && card.id === useCard.id
          return (
            <label
              key={card.id}
              htmlFor={card.id}
              className="relative cursor-pointer"
            >
              <RadioGroupItem
                value={card.id}
                id={card.id}
                className="sr-only"
                onClick={() => setUseCard(card)}
              />
              <CardInfo
                card={card}
                onClick={() => setUseCard(card)}
                className={
                  isSelected
                    ? "ring-2 ring-flathub-celestial-blue ring-offset-2 ring-offset-flathub-lotion dark:ring-offset-flathub-dark-gunmetal"
                    : "ring-1 ring-transparent hover:ring-flathub-sonic-silver/30"
                }
              />
              {isSelected && (
                <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-flathub-celestial-blue text-white shadow-md">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </label>
          )
        })}
      </RadioGroup>
    )
  }

  // Should always present the option to use a new card in case user
  // doesn't want to wait for a slow network
  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px] pt-8">
      <div className="flex flex-col gap-8 rounded-2xl bg-flathub-white p-6 shadow-lg dark:bg-flathub-arsenic/80 border border-flathub-gainsborow/30 dark:border-flathub-granite-gray/20">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <h3 className="text-2xl font-semibold tracking-tight">
              {t("saved-cards")}
            </h3>
          </div>
          {cardSection}
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end border-t border-flathub-gainsborow/50 dark:border-flathub-granite-gray/30 pt-6">
          <TransactionCancelButtonPrep
            transactionId={transaction.summary.id}
            disabled={isProcessing}
            className="w-full sm:w-auto"
          />
          <Button
            size="lg"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={skip}
            disabled={isProcessing}
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
            disabled={!useCard || isProcessing}
          >
            {isProcessing && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("confirm-selection")}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default CardSelect
