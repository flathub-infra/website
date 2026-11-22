import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { useTranslations } from "next-intl"
import { FormEvent, FunctionComponent, useState } from "react"
import Spinner from "../../Spinner"
import {
  type CheckoutIntent,
  confirmWalletPayment,
  createCardToken,
} from "./stripe"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "src/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { TransactionCancelButtonPrep } from "./Checkout"

interface Props {
  transactionId: string
  callbackPage: string
  intent: CheckoutIntent
  onError: (error: unknown) => Promise<void>
  canGoBack: boolean
  goBack: () => void
}

const PaymentForm: FunctionComponent<Props> = ({
  transactionId,
  callbackPage,
  intent,
  onError,
  canGoBack,
  goBack,
}) => {
  const t = useTranslations()
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()

  // UI control state
  const [checked, setChecked] = useState(false)
  const mutation = useMutation({
    mutationFn: async () => {
      const token = await createCardToken(stripe, elements, checked)
      await confirmWalletPayment(stripe, transactionId, intent, {
        confirmation_token: token,
        save_card: checked,
      })
    },
    onSuccess: () => router.push(callbackPage),
    onError,
  })

  return (
    <form
      className="flex flex-col gap-5 p-5 bg-flathub-white dark:bg-flathub-arsenic rounded-xl shadow-md text-flathub-dark-gunmetal  dark:text-flathub-gainsborow"
      onSubmit={handleSubmit}
    >
      <h3 className="text-xl font-semibold m-0">{t("payment-details")}</h3>
      <PaymentElement />
      {mutation.isPending ? (
        <Spinner size="s" />
      ) : (
        <>
          <div className="items-top flex ms-auto space-x-3 pt-2">
            <Checkbox
              id="save-card"
              checked={checked}
              onCheckedChange={(event) => {
                setChecked(event === true)
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
