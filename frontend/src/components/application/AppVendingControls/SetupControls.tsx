import { useTranslations } from "next-intl"
import {
  FormEvent,
  FunctionComponent,
  ReactElement,
  useCallback,
  useEffect,
  useState,
} from "react"
import { toast } from "sonner"
import { FLATHUB_MIN_PAYMENT, STRIPE_MAX_PAYMENT } from "../../../env"
import { Appstream } from "../../../types/Appstream"
import { NumericInputValue } from "../../../types/Input"
import * as Currency from "../../currency"
import Spinner from "../../Spinner"
import VendingSharesPreview from "./VendingSharesPreview"
import { useMutation, useQuery } from "@tanstack/react-query"
import { AxiosError } from "axios"
import {
  getAppVendingSetupVendingappAppIdSetupGet,
  postAppVendingSetupVendingappAppIdSetupPost,
  statusVendingStatusGet,
  VendingConfig,
} from "src/codegen"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Link } from "src/i18n/navigation"

interface Props {
  app: Pick<Appstream, "id" | "name" | "bundle">
  vendingConfig: VendingConfig
}

/**
 * The control elements to see and alter the vending price and split for an application.
 * It is assumed that parent will check whether to render these to the logged in user.
 */
const SetupControls: FunctionComponent<Props> = ({ app, vendingConfig }) => {
  const t = useTranslations()

  const [vendingEnabled, setVendingEnabled] = useState(false)
  const [requirePayment, setRequirePayment] = useState(false)

  const statusQuery = useQuery({
    queryKey: ["/vending/status"],
    queryFn: () =>
      statusVendingStatusGet({
        withCredentials: true,
      }),
  })

  // Need existing app vending configuration to initialise controls
  const vendingSetup = useQuery({
    queryKey: ["appVendingSetup", app.id],
    queryFn: () =>
      getAppVendingSetupVendingappAppIdSetupGet(app.id, {
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
      postAppVendingSetupVendingappAppIdSetupPost(
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
      if (error && error.response) {
        toast.error(t(error.response.data.error))
      } else {
        console.error(error)
      }
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

  if (
    statusQuery.isPending ||
    vendingSetup.isPending ||
    setAppVendingSetupMutation.isPending
  ) {
    return <Spinner size="m" />
  }

  if (!statusQuery.data.data || !statusQuery.data.data.details_submitted) {
    return (
      <p>
        <Link href="/developer-portal#accepting-payment">
          {t("vending-onboard")}
        </Link>
      </p>
    )
  }

  if (vendingSetup.isError) {
    return <p>{t(vendingSetup.error.message)}</p>
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <div className="flex items-center gap-3 border-b border-slate-400/20 pb-3">
        <Switch checked={vendingEnabled} onCheckedChange={setVendingEnabled} />
        <label>{t("enable-app-vending")}</label>
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
      {vendingEnabled && (
        <div>
          <VendingSharesPreview
            price={recommendedDonation.live * 100}
            app={app}
            appShare={appShare}
            setAppShare={setAppShare}
            vendingConfig={vendingConfig}
            interactive
          />
        </div>
      )}
      <div className="flex items-center gap-3 border-t border-slate-400/20 pt-3">
        <Switch checked={requirePayment} onCheckedChange={setRequirePayment} />
        <label>{t("require-payment")}</label>
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
            setAppShare={() => {}}
            vendingConfig={vendingConfig}
          />
        </div>
      )}
      <div className="border-t border-slate-400/20 pt-3">
        <Button size="lg" disabled={!isValidState} type="submit">
          {t("confirm-settings")}
        </Button>
      </div>
    </form>
  )
}

export default SetupControls
