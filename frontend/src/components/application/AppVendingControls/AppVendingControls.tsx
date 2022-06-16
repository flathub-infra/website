import { useTranslation } from "next-i18next"
import {
  FormEvent,
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from "react"
import { toast } from "react-toastify"
import { getAppVendingSetup, setAppVendingSetup } from "../../../asyncs/vending"
import { useAsync } from "../../../hooks/useAsync"
import { Appstream } from "../../../types/Appstream"
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
const AppVendingControls: FunctionComponent<Props> = ({
  app,
  vendingConfig,
}) => {
  const { t } = useTranslation()

  // Need existing app vending configuration to initialise controls
  const {
    status,
    value: vendingSetup,
    error,
  } = useAsync(useCallback(() => getAppVendingSetup(app.id), [app.id]))

  // State shared by controls lifted to this parent for final submission
  const [appShare, setAppShare] = useState(50)
  const [recommendedDonation, setRecommendedDonation] = useState("0.00")
  const [minPayment, setMinPayment] = useState("0.00")

  // Controls should initialise to existing setup once known
  useEffect(() => {
    if (vendingSetup) {
      setAppShare(vendingSetup.appshare)
      setRecommendedDonation(
        (vendingSetup.recommended_donation / 100).toFixed(2),
      )
      setMinPayment((vendingSetup.minimum_payment / 100).toFixed(2))
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
          minimum_payment: Number(minPayment) * 100,
          recommended_donation: Number(recommendedDonation) * 100,
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

  if (error) return <p>{t(error)}</p>

  // TODO: Enforce and provide feedback if minimum > recommended
  return (
    <>
      <h3>{t("accepting-payment")}</h3>
      <form
        className="flex flex-col gap-6 rounded-xl bg-bgColorSecondary p-4"
        onSubmit={handleSubmit}
      >
        <div>
          <label>{t("recommended-payment")}</label>
          <CurrencyInput
            value={recommendedDonation}
            setValue={setRecommendedDonation}
          />
        </div>
        <div>
          <label>{t("minimum-payment")}</label>
          <CurrencyInput value={minPayment} setValue={setMinPayment} />
        </div>
        <div>
          <label>{t("application-share")}</label>
          <AppShareSlider value={appShare} setValue={setAppShare} />
        </div>
        <div>
          <VendingSharesPreview
            price={Number(recommendedDonation) * 100}
            app={app}
            appShare={appShare}
            vendingConfig={vendingConfig}
          />
        </div>
        <div>
          <Button
            disabled={Number(minPayment) > Number(recommendedDonation)}
            type="submit"
          >
            {t("confirm-settings")}
          </Button>
        </div>
      </form>
    </>
  )
}

export default AppVendingControls
