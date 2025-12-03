import { useLocale, useTranslations } from "next-intl"
import { FunctionComponent } from "react"
import { toast } from "sonner"
import { FLATHUB_MIN_PAYMENT, STRIPE_MAX_PAYMENT } from "../../../env"
import { NumericInputValue } from "../../../types/Input"
import { formatCurrency } from "../../../utils/localize"
import * as Currency from "../../currency"
import VendingSharesPreview from "./VendingSharesPreview"
import { useMutation } from "@tanstack/react-query"
import {
  GetAppstreamAppstreamAppIdGet200,
  postAppVendingStatusVendingappAppIdPost,
  VendingConfig,
  VendingSetup,
} from "src/codegen"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { useRouter } from "src/i18n/navigation"

interface Props {
  app: Pick<GetAppstreamAppstreamAppIdGet200, "id" | "name" | "bundle">
  vendingConfig: VendingConfig
  amount: NumericInputValue
  setAmount: (amount: NumericInputValue) => void
  vendingSetup: VendingSetup
}

type FormData = {
  amount: number
}

/**
 * The control elements to set purchasers intent before creating a transaction.
 */
const PurchaseControls: FunctionComponent<Props> = ({
  app,
  vendingConfig,
  amount,
  setAmount,
  vendingSetup,
}) => {
  const t = useTranslations()
  const router = useRouter()
  const locale = useLocale()

  const { handleSubmit, control } = useForm<FormData>()

  // Prepare submission logic to create a transaction
  const submitPurchaseMutation = useMutation({
    mutationKey: ["vending-status-app", app.id, amount.settled * 100, "usd"],
    mutationFn: () => {
      return postAppVendingStatusVendingappAppIdPost(
        app.id,
        {
          currency: "usd",
          amount: amount.settled * 100,
        },
        {
          withCredentials: true,
        },
      )
    },
    onSuccess: (data) => {
      router.push(`/payment/${data.data.transaction}`, undefined)
    },
    onError: (error) => {
      toast.error(t(error.message))
    },
  })

  // Obtain currency values for display
  const prettyMinimum = formatCurrency(
    vendingSetup.minimum_payment / 100,
    locale,
  )
  const prettyRecommended = formatCurrency(
    vendingSetup.recommended_donation / 100,
    locale,
  )

  const canSubmit =
    amount.live * 100 >= vendingSetup.minimum_payment &&
    amount.live >= FLATHUB_MIN_PAYMENT &&
    amount.live <= STRIPE_MAX_PAYMENT

  // When the minimum payment is 0, the application does not require payment
  const isDonationOnly = vendingSetup.minimum_payment === 0

  return (
    <form
      className="mx-0 my-5 flex flex-col gap-6 rounded-2xl bg-flathub-white p-6 shadow-lg dark:bg-flathub-arsenic/80 border border-flathub-gainsborow/30 dark:border-flathub-granite-gray/20"
      onSubmit={handleSubmit(() => submitPurchaseMutation.mutate())}
    >
      {!isDonationOnly && (
        <div className="text-sm text-flathub-sonic-silver dark:text-flathub-spanish-gray leading-relaxed">
          {t("app-payment-information", {
            minvalue: prettyMinimum,
            recvalue: prettyRecommended,
          })}
        </div>
      )}
      <h4 className="m-0 text-base font-medium text-flathub-dark-gunmetal dark:text-flathub-lotion">
        {t(
          isDonationOnly ? "select-donation-amount" : "select-purchase-amount",
        )}
      </h4>
      <Currency.Input
        inputValue={amount}
        setValue={setAmount}
        maximum={STRIPE_MAX_PAYMENT}
      />
      <Currency.MinMaxError
        value={amount}
        minimum={Math.max(
          vendingSetup.minimum_payment / 100,
          FLATHUB_MIN_PAYMENT,
        )}
        maximum={STRIPE_MAX_PAYMENT}
      />
      <VendingSharesPreview
        price={amount.live * 100}
        app={app}
        appShare={vendingSetup.appshare}
        setAppShare={() => {}}
        vendingConfig={vendingConfig}
      />
      <div className="flex justify-end">
        <Button
          size="lg"
          disabled={!canSubmit || submitPurchaseMutation.isPending}
        >
          {submitPurchaseMutation.isPending && (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          )}
          {t(isDonationOnly ? "action-donate" : "action-purchase")}
        </Button>
      </div>
    </form>
  )
}

export default PurchaseControls
