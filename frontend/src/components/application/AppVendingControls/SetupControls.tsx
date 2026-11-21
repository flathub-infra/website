import { useTranslations } from "next-intl"
import { FormEvent, FunctionComponent, useCallback, useState } from "react"
import { toast } from "sonner"
import { FLATHUB_MIN_PAYMENT, STRIPE_MAX_PAYMENT } from "../../../env"
import { NumericInputValue } from "../../../types/Input"
import * as Currency from "../../currency"
import Spinner from "../../Spinner"
import VendingSharesPreview from "./VendingSharesPreview"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AxiosError } from "axios"
import {
  GetAppstreamAppstreamAppIdGet200,
  postAppVendingSetupVendingappAppIdSetupPost,
  statusVendingStatusGet,
  VendingConfig,
} from "src/codegen"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Link } from "src/i18n/navigation"
import { CreditCard } from "lucide-react"
import { useManagementSetup } from "./useManagementSetup"

interface Props {
  app: Pick<GetAppstreamAppstreamAppIdGet200, "id" | "name" | "bundle">
  vendingConfig: VendingConfig
}

interface PaymentDraft {
  vendingEnabled: boolean
  requirePayment: boolean
  appShare: number
  recommendedDonation: NumericInputValue
  minPayment: NumericInputValue
}

function paymentAmount(cents: number): NumericInputValue {
  const amount = Math.max(cents / 100, FLATHUB_MIN_PAYMENT)
  return { live: amount, settled: amount }
}

/**
 * The control elements to see and alter the vending price and split for an application.
 * It is assumed that parent will check whether to render these to the logged in user.
 */
const SetupControls: FunctionComponent<Props> = ({ app, vendingConfig }) => {
  const t = useTranslations()
  const client = useQueryClient()

  const [draft, setDraft] = useState<Partial<PaymentDraft>>({})
  function edit(change: Partial<PaymentDraft>) {
    setDraft((previous) => ({ ...previous, ...change }))
  }

  const statusQuery = useQuery({
    queryKey: ["/vending/status"],
    queryFn: () =>
      statusVendingStatusGet({
        withCredentials: true,
      }),
  })

  // Need existing app vending configuration to initialise controls
  const vendingSetup = useManagementSetup(app.id)

  const saved = vendingSetup.data?.data
  const {
    vendingEnabled,
    requirePayment,
    appShare,
    recommendedDonation,
    minPayment,
  } = {
    vendingEnabled: (saved?.recommended_donation ?? 0) > 0,
    requirePayment: (saved?.minimum_payment ?? 0) > 0,
    appShare: saved?.appshare ?? 50,
    recommendedDonation: paymentAmount(saved?.recommended_donation ?? 0),
    minPayment: paymentAmount(saved?.minimum_payment ?? 0),
    ...draft,
  }

  // Tell backend to update the setup on submission
  const setAppVendingSetupMutation = useMutation({
    onMutate: () => vendingSetup.queryKey,
    mutationFn: () =>
      postAppVendingSetupVendingappAppIdSetupPost(
        app.id,
        {
          currency: "usd",
          appshare: appShare,
          minimum_payment:
            vendingEnabled && requirePayment
              ? Math.round(minPayment.live * 100)
              : 0,
          recommended_donation: vendingEnabled
            ? Math.round(recommendedDonation.live * 100)
            : 0,
        },
        {
          withCredentials: true,
        },
      ),
    onSuccess: async (data, _variables, queryKey) => {
      if (!queryKey || !client.getQueryState(queryKey)) {
        return
      }
      await client.cancelQueries({ queryKey, exact: true })
      client.setQueryData(queryKey, (previous) =>
        previous === undefined ? undefined : data,
      )
      setDraft({})
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

  if (!statusQuery.data || !vendingSetup.data) {
    return <p role="alert">{t("failed-to-load-refresh")}</p>
  }
  if (
    vendingSetup.data.data.status === "ok" &&
    !vendingSetup.data.data.is_owner
  ) {
    return <p>{t("app-management.payments-owner-only")}</p>
  }
  if (!statusQuery.data.data || !statusQuery.data.data.details_submitted) {
    return (
      <div className="flex flex-col items-start gap-6">
        <p className="max-w-prose text-sm leading-relaxed text-foreground">
          {t("app-management.payments-description")}
        </p>
        <div className="flex w-full flex-col items-start justify-between gap-5 border-t border-border pt-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <CreditCard
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold">Stripe Express</h3>
              <p className="text-sm text-muted-foreground">
                {t("app-management.payment-account-status")}
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href="/developer-portal#accepting-payment">
              {t("app-management.set-up-payments")}
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <div className="flex items-center gap-3 border-b border-slate-400/20 pb-3">
        <Switch
          checked={vendingEnabled}
          onCheckedChange={(vendingEnabled) => edit({ vendingEnabled })}
        />
        <label>{t("enable-app-vending")}</label>
      </div>
      <div>
        <label>{t("recommended-payment")}</label>
        <Currency.Input
          inputValue={recommendedDonation}
          setValue={(recommendedDonation) => edit({ recommendedDonation })}
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
            setAppShare={(appShare) => edit({ appShare })}
            vendingConfig={vendingConfig}
            interactive
          />
        </div>
      )}
      <div className="flex items-center gap-3 border-t border-slate-400/20 pt-3">
        <Switch
          checked={requirePayment}
          onCheckedChange={(requirePayment) => edit({ requirePayment })}
        />
        <label>{t("require-payment")}</label>
      </div>
      <div>
        <label>{t("minimum-payment")}</label>
        <Currency.Input
          inputValue={minPayment}
          setValue={(minPayment) => edit({ minPayment })}
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
