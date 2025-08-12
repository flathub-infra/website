import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { useTranslations } from "next-intl"
import { FormEvent, FunctionComponent, useState } from "react"
import Spinner from "../../Spinner"
import { handleStripeError } from "./stripe"
import { useMutation } from "@tanstack/react-query"
import { AxiosError } from "axios"
import {
  setPendingWalletTransactionsTxnSetpendingPost,
  setSavecardWalletTransactionsTxnSavecardPost,
} from "src/codegen"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { TransactionCancelButtonPrep } from "./Checkout"

interface Props {
  transactionId: string
  callbackPage: string
  canGoBack: boolean
  goBack: () => void
}

const PaymentForm: FunctionComponent<Props> = ({
  transactionId,
  callbackPage,
  canGoBack,
  goBack,
}) => {
  const t = useTranslations()
  const stripe = useStripe()
  const elements = useElements()

  // UI control state
  const [checked, setChecked] = useState(false)
  const [processing, setProcessing] = useState(false)

  const mutation = useMutation({
    mutationFn: async () => {
      setProcessing(true)

      if (checked) {
        await setSavecardWalletTransactionsTxnSavecardPost(
          transactionId,
          { save_card: "on_session" },
          {
            withCredentials: true,
          },
        )
      }
      return await setPendingWalletTransactionsTxnSetpendingPost(
        transactionId,
        {
          withCredentials: true,
        },
      )
    },
    onSuccess: async () => {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: callbackPage,
        },
      })

      // Redirect will have occurred otherwise
      if (result.error) {
        handleStripeError(result.error)
      }
    },
    onError: (err: AxiosError) => {
      setProcessing(false)
    },
  })

  return (
    <form
      className="flex flex-col gap-4 p-5 text-flathub-dark-gunmetal  dark:text-flathub-gainsborow"
      onSubmit={handleSubmit}
    >
      <PaymentElement />
      {processing ? (
        <Spinner size="s" />
      ) : (
        <>
          <div className="items-top flex space-x-3 pt-2">
            <Checkbox
              id="save-card"
              checked={checked}
              onCheckedChange={(event) => {
                setChecked(Boolean(event))
              }}
            />
            <div className="grid gap-1.5 leading-none">
              <label
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                htmlFor="save-card"
              >
                {t("save-card-for-reuse")}
              </label>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-4 sm:flex-row">
            <TransactionCancelButtonPrep transactionId={transactionId} />
            <Button
              size="lg"
              className="ms-auto w-full sm:w-auto"
              type="button"
              onClick={goBack}
              disabled={!canGoBack}
            >
              {t("use-saved-card")}
            </Button>
            <Button size="lg" className="w-full sm:w-auto">
              {t("submit-payment")}
            </Button>
          </div>
        </>
      )}
    </form>
  )

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    // Can't submit when Stripe isn't ready
    if (!stripe || !elements) {
      return
    }

    mutation.mutate()
  }
}

export default PaymentForm
