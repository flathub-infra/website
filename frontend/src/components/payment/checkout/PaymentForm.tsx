import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { useTranslation } from "next-i18next"
import { FormEvent, FunctionComponent, ReactElement, useState } from "react"
import { toast } from "react-toastify"
import {
  setTransactionPending,
  setTransactionSaveCard,
} from "../../../asyncs/payment"
import Button from "../../Button"
import Spinner from "../../Spinner"
import { handleStripeError } from "./stripe"

interface Props {
  transactionId: string
  callbackPage: string
  canGoBack: boolean
  goBack: () => void
  transactionCancelButton: ReactElement
}

const PaymentForm: FunctionComponent<Props> = ({
  transactionId,
  callbackPage,
  canGoBack,
  goBack,
  transactionCancelButton,
}) => {
  const { t } = useTranslation()
  const stripe = useStripe()
  const elements = useElements()

  // UI control state
  const [checked, setChecked] = useState(false)
  const [processing, setProcessing] = useState(false)

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
          <div className="relative flex items-start">
            <div className="flex h-5 items-center">
              <input
                id="save-card"
                type="checkbox"
                aria-describedby="card-description"
                className="h-4 w-4"
                checked={checked}
                onChange={() => setChecked(!checked)}
              />
            </div>
            <div className="ms-3 text-sm">
              <label htmlFor="save-card" className="font-medium">
                {t("save-card-for-reuse")}
              </label>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-4 sm:flex-row">
            {transactionCancelButton}
            <Button
              className="ms-auto w-full sm:w-auto"
              type="button"
              onClick={goBack}
              disabled={!canGoBack}
            >
              {t("use-saved-card")}
            </Button>
            <Button className="w-full sm:w-auto">{t("submit-payment")}</Button>
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

    submit().catch((err) => {
      toast.error(t(err))
      setProcessing(false)
    })
  }

  async function submit() {
    setProcessing(true)

    if (checked) {
      await setTransactionSaveCard(transactionId)
    }

    await setTransactionPending(transactionId)

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
  }
}

export default PaymentForm
