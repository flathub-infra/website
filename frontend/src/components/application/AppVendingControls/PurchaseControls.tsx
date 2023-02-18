import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import {
  FormEvent,
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from "react"
import { toast } from "react-toastify"
import { getAppVendingSetup, initiateAppPayment } from "../../../asyncs/vending"
import { FLATHUB_MIN_PAYMENT, STRIPE_MAX_PAYMENT } from "../../../env"
import { useAsync } from "../../../hooks/useAsync"
import { Appstream } from "../../../types/Appstream"
import { NumericInputValue } from "../../../types/Input"
import { VendingConfig } from "../../../types/Vending"
import { formatCurrency } from "../../../utils/localize"
import Button from "../../Button"
import * as Currency from "../../currency"
import Spinner from "../../Spinner"
import VendingSharesPreview from "./VendingSharesPreview"

interface Props {
  app: Appstream
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

  const {
    status,
    value: vendingSetup,
    error,
  } = useAsync(useCallback(() => getAppVendingSetup(app.id), [app.id]))

  useEffect(() => {
    if (vendingSetup) {
      const decimalValue = vendingSetup.recommended_donation / 100
      setAmount({
        live: decimalValue,
        settled: decimalValue,
      })
    }
  }, [vendingSetup])

  // Prepare submission logic to create a transaction
  const {
    execute: submit,
    status: submitStatus,
    value: submitValue,
    error: submitError,
  } = useAsync(
    useCallback(
      () =>
        initiateAppPayment(app.id, {
          currency: "usd",
          amount: amount.settled * 100,
        }),
      [app.id, amount],
    ),
    false,
  )

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      submit()
    },
    [submit],
  )

  // Feedback on submission informs user of failure/success
  useEffect(() => {
    if (submitError) {
      toast.error(t(submitError))
    }
  }, [submitError, t])

  useEffect(() => {
    if (submitValue) {
      router.push(`/payment/${submitValue.transaction}`)
    }
  }, [submitValue, router])

  if (error) {
    return (
      <>
        <h1 className="my-8">{t("whoops")}</h1>
        <p>{t(error)}</p>
      </>
    )
  }

  // Prevent control interaction while initalising and awaiting submission redirection
  if (
    ["pending", "idle"].includes(status) ||
    ["pending", "success"].includes(submitStatus)
  ) {
    return <Spinner size="s" />
  }

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
      className="my-5 mx-0 flex flex-col gap-5 rounded-xl bg-flathub-white p-5 dark:bg-flathub-jet"
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
      <h4 className="m-0">
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
        vendingConfig={vendingConfig}
      />
      <div>
        <Button disabled={!canSubmit}>
          {t(isDonationOnly ? "make-donation" : "kind-purchase")}
        </Button>
      </div>
    </form>
  )
}

export default PurchaseControls
