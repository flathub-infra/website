import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import { FormEvent, FunctionComponent, useCallback, useState } from "react"
import { toast } from "react-toastify"
import { FLATHUB_MIN_PAYMENT, STRIPE_MAX_PAYMENT } from "../../../env"
import { Appstream } from "../../../types/Appstream"
import { NumericInputValue } from "../../../types/Input"
import { VendingConfig } from "../../../types/Vending"
import { formatCurrency } from "../../../utils/localize"
import * as Currency from "../../currency"
import Spinner from "../../Spinner"
import VendingSharesPreview from "./VendingSharesPreview"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  getAppVendingSetupVendingappAppIdSetupGet,
  postAppVendingStatusVendingappAppIdPost,
} from "src/codegen"
import { Button } from "@/components/ui/button"

interface Props {
  app: Pick<Appstream, "id" | "name" | "bundle">
  vendingConfig: VendingConfig
}

/**
 * The control elements to set purchasers intent before creating a transaction.
 */
const PurchaseControls: FunctionComponent<Props> = ({ app, vendingConfig }) => {
  const { t, i18n } = useTranslation()
  const router = useRouter()

  // Need app vending configuration to initialise payment value
  const [amount, setAmount] = useState<NumericInputValue>({
    live: 0,
    settled: 0,
  })

  const vendingSetup = useQuery({
    queryKey: ["appVendingSetup", app.id],
    queryFn: async () => {
      const setup = await getAppVendingSetupVendingappAppIdSetupGet(app.id, {
        withCredentials: true,
      })

      const decimalValue = setup.data.recommended_donation / 100
      setAmount({
        live: decimalValue,
        settled: decimalValue,
      })

      return setup
    },
    enabled: !!app.id,
  })

  // Prepare submission logic to create a transaction
  const submitPurchaseMutation = useMutation({
    mutationKey: ["vending-status-app", app.id, amount.settled * 100],
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

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      submitPurchaseMutation.mutate()
    },
    [submitPurchaseMutation],
  )

  if (vendingSetup.isError) {
    return (
      <>
        <h1 className="my-8 text-4xl font-extrabold">{t("whoops")}</h1>
        <p>{t(vendingSetup.error.message)}</p>
      </>
    )
  }

  // Prevent control interaction while initalising and awaiting submission redirection
  if (vendingSetup.isPending || submitPurchaseMutation.isPending) {
    return <Spinner size="s" />
  }

  // Obtain currency values for display
  const prettyMinimum = formatCurrency(
    vendingSetup.data.data.minimum_payment / 100,
    i18n.language,
  )
  const prettyRecommended = formatCurrency(
    vendingSetup.data.data.recommended_donation / 100,
    i18n.language,
  )

  const canSubmit =
    amount.live * 100 >= vendingSetup.data.data.minimum_payment &&
    amount.live >= FLATHUB_MIN_PAYMENT &&
    amount.live <= STRIPE_MAX_PAYMENT

  // When the minimum payment is 0, the application does not require payment
  const isDonationOnly = vendingSetup.data.data.minimum_payment === 0

  return (
    <form
      className="mx-0 my-5 flex flex-col gap-5 rounded-xl bg-flathub-white p-5 dark:bg-flathub-arsenic"
      onSubmit={handleSubmit}
    >
      {!isDonationOnly && (
        <p>
          {t("app-payment-information", {
            minvalue: prettyMinimum,
            recvalue: prettyRecommended,
          })}
        </p>
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
          vendingSetup.data.data.minimum_payment / 100,
          FLATHUB_MIN_PAYMENT,
        )}
        maximum={STRIPE_MAX_PAYMENT}
      />
      <VendingSharesPreview
        price={amount.live * 100}
        app={app}
        appShare={vendingSetup.data.data.appshare}
        vendingConfig={vendingConfig}
      />
      <div>
        <Button size="lg" disabled={!canSubmit}>
          {t(isDonationOnly ? "make-donation" : "kind-purchase")}
        </Button>
      </div>
    </form>
  )
}

export default PurchaseControls
