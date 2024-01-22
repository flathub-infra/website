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
import { FLATHUB_MIN_PAYMENT, STRIPE_MAX_PAYMENT } from "../../../env"
import { Appstream } from "../../../types/Appstream"
import { NumericInputValue } from "../../../types/Input"
import { VendingConfig } from "../../../types/Vending"
import Button from "../../Button"
import * as Currency from "../../currency"
import Spinner from "../../Spinner"
import Toggle from "../../Toggle"
import AppShareSlider from "./AppShareSlider"
import VendingSharesPreview from "./VendingSharesPreview"
import { useMutation, useQuery } from "@tanstack/react-query"
import { vendingApi } from "src/api"
import { AxiosError } from "axios"

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
  const vendingSetup = useQuery({
    queryKey: ["appVendingSetup", app.id],
    queryFn: () =>
      vendingApi.getAppVendingSetupVendingappAppIdSetupGet(app.id, {
        withCredentials: true,
      }),
  })

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
    if (vendingSetup.data) {
      const decimalRecommendation = Math.max(
        vendingSetup.data.data.recommended_donation / 100,
        FLATHUB_MIN_PAYMENT,
      )
      const decimalMinimum = Math.max(
        vendingSetup.data.data.minimum_payment / 100,
        FLATHUB_MIN_PAYMENT,
      )

      setAppShare(vendingSetup.data.data.appshare)
      setRecommendedDonation({
        live: decimalRecommendation,
        settled: decimalRecommendation,
      })
      setMinPayment({
        live: decimalMinimum,
        settled: decimalMinimum,
      })
      setRequirePayment(vendingSetup.data.data.minimum_payment > 0)
      setVendingEnabled(vendingSetup.data.data.recommended_donation > 0)
    }
  }, [vendingSetup.data])

  // Tell backend to update the setup on submission
  const setAppVendingSetupMutation = useMutation({
    mutationFn: () =>
      vendingApi.postAppVendingSetupVendingappAppIdSetupPost(
        app.id,
        {
          currency: "usd",
          appshare: appShare,
          minimum_payment:
            vendingEnabled && requirePayment ? minPayment.settled * 100 : 0,
          recommended_donation: vendingEnabled
            ? recommendedDonation.settled * 100
            : 0,
        },
        {
          withCredentials: true,
        },
      ),
    onSuccess: (data) => {
      toast.success(t("app-vending-settings-confirmed"))
    },
    onError: (error: AxiosError<{ status: string; error: string }>) => {
      toast.error(t(error.response.data.error))
    },
  })

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setAppVendingSetupMutation.mutate()
    },
    [setAppVendingSetupMutation],
  )

  const isValidRecommended =
    (!requirePayment || recommendedDonation.live >= minPayment.live) &&
    recommendedDonation.live >= FLATHUB_MIN_PAYMENT &&
    recommendedDonation.live <= STRIPE_MAX_PAYMENT

  const isValidState =
    isValidRecommended &&
    (!requirePayment || minPayment.live >= FLATHUB_MIN_PAYMENT)

  if (vendingSetup.isPending || setAppVendingSetupMutation.isPending) {
    return <Spinner size="m" />
  }

  let content: ReactElement
  if (vendingSetup.isError) {
    content = <p>{t(vendingSetup.error.message)}</p>
  } else {
    content = (
      <form
        className="flex flex-col gap-6 rounded-xl bg-flathub-white p-4 dark:bg-flathub-arsenic"
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
            maximum={STRIPE_MAX_PAYMENT}
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
          <label>{t("app-share")}</label>
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
            maximum={STRIPE_MAX_PAYMENT}
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
      <h2 className="mb-6 text-2xl font-bold">{t("accepting-payment")}</h2>
      {content}
    </>
  )
}

export default SetupControls
