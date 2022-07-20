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
import { FLATHUB_MIN_PAYMENT, STRIPE_MAX_PAYMENT } from "../../../env"
import { useAsync } from "../../../hooks/useAsync"
import { Appstream } from "../../../types/Appstream"
import { NumericInputValue } from "../../../types/Input"
import { VendingConfig } from "../../../types/Vending"
import Button from "../../Button"
import * as Currency from "../../currency"
import Spinner from "../../Spinner"
import Toggle from "../../Toggle"
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

  const [vendingEnabled, setVendingEnabled] = useState(false)
  const [requirePayment, setRequirePayment] = useState(false)

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
      const decimalRecommendation = Math.max(
        vendingSetup.recommended_donation / 100,
        FLATHUB_MIN_PAYMENT,
      )
      const decimalMinimum = Math.max(
        vendingSetup.minimum_payment / 100,
        FLATHUB_MIN_PAYMENT,
      )

      setAppShare(vendingSetup.appshare)
      setRecommendedDonation({
        live: decimalRecommendation,
        settled: decimalRecommendation,
      })
      setMinPayment({
        live: decimalMinimum,
        settled: decimalMinimum,
      })
      setRequirePayment(vendingSetup.minimum_payment > 0)
      setVendingEnabled(vendingSetup.recommended_donation > 0)
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
          minimum_payment:
            vendingEnabled && requirePayment ? minPayment.settled * 100 : 0,
          recommended_donation: vendingEnabled
            ? recommendedDonation.settled * 100
            : 0,
        }),
      [
        app.id,
        appShare,
        minPayment,
        recommendedDonation,
        vendingEnabled,
        requirePayment,
      ],
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

  const isValidRecommended =
    (!requirePayment || recommendedDonation.live >= minPayment.live) &&
    recommendedDonation.live >= FLATHUB_MIN_PAYMENT &&
    recommendedDonation.live <= STRIPE_MAX_PAYMENT

  const isValidState =
    isValidRecommended &&
    (!requirePayment || minPayment.live >= FLATHUB_MIN_PAYMENT)

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
        <div className="flex gap-3 border-b border-slate-400/20 pb-3">
          <label>{t("enable-app-vending")}</label>
          <Toggle enabled={vendingEnabled} setEnabled={setVendingEnabled} />
        </div>
        <div>
          <label>{t("recommended-payment")}</label>
          <Currency.Input
            inputValue={recommendedDonation}
            setValue={setRecommendedDonation}
            disabled={!vendingEnabled}
          />
          <Currency.MinMaxError
            value={recommendedDonation}
            minimum={Math.max(
              FLATHUB_MIN_PAYMENT,
              requirePayment ? minPayment.settled : 0,
            )}
            maximum={STRIPE_MAX_PAYMENT}
          />
        </div>
        <div>
          <label>{t("application-share")}</label>
          <AppShareSlider
            value={appShare}
            setValue={setAppShare}
            disabled={!vendingEnabled}
          />
        </div>
        {vendingEnabled && (
          <div>
            <VendingSharesPreview
              price={recommendedDonation.live * 100}
              app={app}
              appShare={appShare}
              vendingConfig={vendingConfig}
            />
          </div>
        )}
        <div className="flex gap-3 border-t border-slate-400/20 pt-3">
          <label>{t("require-payment")}</label>
          <Toggle enabled={requirePayment} setEnabled={setRequirePayment} />
        </div>
        <div>
          <label>{t("minimum-payment")}</label>
          <Currency.Input
            inputValue={minPayment}
            setValue={setMinPayment}
            disabled={!vendingEnabled || !requirePayment}
          />
          <Currency.MinMaxError
            value={minPayment}
            minimum={FLATHUB_MIN_PAYMENT}
            maximum={STRIPE_MAX_PAYMENT}
          />
        </div>
        {vendingEnabled && requirePayment && (
          <div>
            <VendingSharesPreview
              price={minPayment.live * 100}
              app={app}
              appShare={appShare}
              vendingConfig={vendingConfig}
            />
          </div>
        )}
        <div className="border-t border-slate-400/20 pt-3">
          <Button disabled={!isValidState} type="submit">
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
