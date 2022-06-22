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
import { useAsync } from "../../../hooks/useAsync"
import { getIntlLocale } from "../../../localize"
import { Appstream } from "../../../types/Appstream"
import { NumericInputValue } from "../../../types/Input"
import { VendingConfig } from "../../../types/Vending"
import Button from "../../Button"
import CurrencyInput from "../../CurrencyInput"
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

  // TODO: handle error case
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

  // Prevent control interaction while initalising and awaiting submission redirection
  if (
    ["pending", "idle"].includes(status) ||
    ["pending", "success"].includes(submitStatus)
  ) {
    return <Spinner size="s" />
  }

  // Obtain currency values for display
  const formatter = new Intl.NumberFormat(
    getIntlLocale(i18n.language).toString(),
    {
      style: "currency",
      currency: "USD",
      currencyDisplay: "symbol",
    },
  )

  const prettyMinimum = formatter.format(vendingSetup.minimum_payment / 100)
  const prettyRecommended = formatter.format(
    vendingSetup.recommended_donation / 100,
  )

  return (
    <form
      className="my-5 mx-0 flex flex-col gap-5 rounded-xl bg-bgColorSecondary p-5"
      onSubmit={handleSubmit}
    >
      <p>
        {t("app-payment-information", {
          minvalue: prettyMinimum,
          recvalue: prettyRecommended,
        })}
      </p>
      <h4 className="m-0">{t("select-purchase-amount")}</h4>
      <CurrencyInput
        value={amount}
        setValue={setAmount}
        minimum={vendingSetup.minimum_payment / 100}
      />
      <VendingSharesPreview
        price={amount.live * 100}
        app={app}
        appShare={vendingSetup.appshare}
        vendingConfig={vendingConfig}
      />
      <Button disabled={vendingSetup.minimum_payment > amount.live * 100}>
        {t("kind-purchase")}
      </Button>
    </form>
  )
}

export default PurchaseControls
