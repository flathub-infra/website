import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { useTranslation } from "next-i18next"
import { FormEvent, FunctionComponent, useState } from "react"
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
}

const PaymentForm: FunctionComponent<Props> = ({
  transactionId,
  callbackPage,
  canGoBack,
  goBack,
}) => {
  const { t } = useTranslation()
  const stripe = useStripe()
  const elements = useElements()

  // UI control state
  const [checked, setChecked] = useState(false)
  const [processing, setProcessing] = useState(false)

  return (
    <form className="flex flex-col gap-3 p-5" onSubmit={handleSubmit}>
      <PaymentElement />
      {processing ? (
        <Spinner size="s" />
      ) : (
        <>
          <div>
            <input
              id="save-card"
              type="checkbox"
              checked={checked}
              onChange={() => setChecked(!checked)}
            />
            <label htmlFor="save-card">{t("save-card-for-reuse")}</label>
          </div>
          <div className="flex gap-3">
            <Button type="button" onClick={goBack} disabled={!canGoBack}>
              {t("use-saved-card")}
            </Button>
            <Button>{t("submit-payment")}</Button>
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
