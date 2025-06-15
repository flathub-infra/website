import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import { FunctionComponent } from "react"
import { toast } from "sonner"
import { FLATHUB_MIN_PAYMENT, STRIPE_MAX_PAYMENT } from "../../../env"
import { Appstream } from "../../../types/Appstream"
import { NumericInputValue } from "../../../types/Input"
import { formatCurrency } from "../../../utils/localize"
import * as Currency from "../../currency"
import VendingSharesPreview from "./VendingSharesPreview"
import { useMutation } from "@tanstack/react-query"
import {
  postAppVendingStatusVendingappAppIdPost,
  VendingConfig,
  VendingSetup,
} from "src/codegen"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"

interface Props {
  app: Pick<Appstream, "id" | "name" | "bundle">
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
  const { t, i18n } = useTranslation()
  const router = useRouter()

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
      router.push(`/payment/${data.data.transaction}`, undefined, {
        locale: router.locale,
      })
    },
    onError: (error) => {
      toast.error(t(error.message))
    },
  })

  // Obtain currency values for display
  const prettyMinimum = formatCurrency(
    vendingSetup.minimum_payment / 100,
    i18n.language,
  )
  const prettyRecommended = formatCurrency(
    vendingSetup.recommended_donation / 100,
    i18n.language,
  )

  const canSubmit =
    amount.live * 100 >= vendingSetup.minimum_payment &&
    amount.live >= FLATHUB_MIN_PAYMENT &&
    amount.live <= STRIPE_MAX_PAYMENT

  // When the minimum payment is 0, the application does not require payment
  const isDonationOnly = vendingSetup.minimum_payment === 0

  return (
    <form
      className="mx-0 my-5 flex flex-col gap-5 rounded-xl bg-flathub-white p-5 dark:bg-flathub-arsenic"
      onSubmit={handleSubmit(() => submitPurchaseMutation.mutate())}
    >
      {!isDonationOnly && (
        <div className={"mb-2 text-sm"}>
          {t("app-payment-information", {
            minvalue: prettyMinimum,
            recvalue: prettyRecommended,
          })}
        </div>
      )}
      <h4 className="m-0 text-base font-normal">
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
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {t(isDonationOnly ? "action-donate" : "action-purchase")}
        </Button>
      </div>
    </form>
  )
}

export default PurchaseControls
