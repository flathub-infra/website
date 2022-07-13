import { useTranslation } from "next-i18next"
import {
  FormEvent,
  FunctionComponent,
  ReactElement,
  useCallback,
  useEffect,
  useState,
} from "react"
import { toast } from "react-toastify"
import { getAppVendingSetup, setAppVendingSetup } from "../../../asyncs/vending"
import { STRIPE_MAX_PAYMENT } from "../../../env"
import { useAsync } from "../../../hooks/useAsync"
import { Appstream } from "../../../types/Appstream"
import { NumericInputValue } from "../../../types/Input"
import { VendingConfig } from "../../../types/Vending"
import Button from "../../Button"
import CurrencyInput from "../../CurrencyInput"
import Spinner from "../../Spinner"
import AppShareSlider from "./AppShareSlider"
import VendingSharesPreview from "./VendingSharesPreview"

interface Props {
  app: Appstream
  vendingConfig: VendingConfig
}

/**
 * The control elements to see and alter the vending price and split for an application.
 * It is assumed that parent will check whether to render these to the logged in user.
 */
const SetupControls: FunctionComponent<Props> = ({ app, vendingConfig }) => {
  const { t } = useTranslation()

  // Need existing app vending configuration to initialise controls
  const {
    status,
    value: vendingSetup,
    error,
  } = useAsync(useCallback(() => getAppVendingSetup(app.id), [app.id]))

  // State shared by controls lifted to this parent for final submission
  const [appShare, setAppShare] = useState(50)
  const [recommendedDonation, setRecommendedDonation] =
    useState<NumericInputValue>({
      live: 0,
      settled: 0,
    })
  const [minPayment, setMinPayment] = useState<NumericInputValue>({
    live: 0,
    settled: 0,
  })

  // Controls should initialise to existing setup once known
  useEffect(() => {
    if (vendingSetup) {
      const decimalRecommendation = vendingSetup.recommended_donation / 100
      const decimalMinimum = vendingSetup.minimum_payment / 100

      setAppShare(vendingSetup.appshare)
      setRecommendedDonation({
        live: decimalRecommendation,
        settled: decimalRecommendation,
      })
      setMinPayment({
        live: decimalMinimum,
        settled: decimalMinimum,
      })
    }
  }, [vendingSetup])

  // Tell backend to update the setup on submission
  const {
    execute: submit,
    status: submitStatus,
    error: submitError,
  } = useAsync(
    useCallback(
      () =>
        setAppVendingSetup(app.id, {
          currency: "usd",
          appshare: appShare,
          minimum_payment: minPayment.settled * 100,
          recommended_donation: recommendedDonation.settled * 100,
        }),
      [app.id, appShare, minPayment, recommendedDonation],
    ),
    false,
  )

  // Submission success feedback lets user know if their changes took effect
  useEffect(() => {
    if (submitStatus == "success") {
      toast.success(t("app-vending-settings-confirmed"))
    }
  }, [t, submitStatus])
  useEffect(() => {
    if (submitError) {
      toast.error(t(submitError))
    }
  }, [t, submitError])

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      submit()
    },
    [submit],
  )

  if (
    ["pending", "idle"].includes(status) ||
    ["pending"].includes(submitStatus)
  ) {
    return <Spinner size="m" />
  }

  let content: ReactElement
  if (error) {
    content = <p>{t(error)}</p>
  } else {
    content = (
      <form
        className="flex flex-col gap-6 rounded-xl bg-bgColorSecondary p-4"
        onSubmit={handleSubmit}
      >
        <div>
          <label>{t("recommended-payment")}</label>
          <CurrencyInput
            inputValue={recommendedDonation}
            setValue={setRecommendedDonation}
            maximum={STRIPE_MAX_PAYMENT}
          />
          {minPayment.settled > recommendedDonation.live && (
            <p role="alert" className="my-2 text-colorDanger">
              {t("value-at-least", { value: minPayment.settled })}
            </p>
          )}
        </div>
        <div>
          <label>{t("minimum-payment")}</label>
          <CurrencyInput
            inputValue={minPayment}
            setValue={setMinPayment}
            maximum={STRIPE_MAX_PAYMENT}
          />
        </div>
        <div>
          <label>{t("application-share")}</label>
          <AppShareSlider value={appShare} setValue={setAppShare} />
        </div>
        <div>
          <VendingSharesPreview
            price={recommendedDonation.live * 100}
            app={app}
            appShare={appShare}
            vendingConfig={vendingConfig}
          />
        </div>
        <div>
          <Button
            disabled={minPayment.live > recommendedDonation.live}
            type="submit"
          >
            {t("confirm-settings")}
          </Button>
        </div>
      </form>
    )
  }

  return (
    <>
      <h3>{t("accepting-payment")}</h3>
      {content}
    </>
  )
}

export default SetupControls
