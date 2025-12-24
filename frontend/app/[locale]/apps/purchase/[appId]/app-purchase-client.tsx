"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import clsx from "clsx"
import * as AppVendingControls from "../../../../../src/components/application/AppVendingControls"
import LoginGuard from "../../../../../src/components/login/LoginGuard"
import { ApplicationCard } from "../../../../../src/components/application/ApplicationCard"
import {
  GetAppstreamAppstreamAppIdGet200,
  useGetAppVendingSetupVendingappAppIdSetupGet,
  VendingConfig,
} from "../../../../../src/codegen"
import { NumericInputValue } from "../../../../../src/types/Input"
import Spinner from "../../../../../src/components/Spinner"
import { isDesktopAppstreamTypeGuard } from "@/lib/helpers"

interface Props {
  app: GetAppstreamAppstreamAppIdGet200
  vendingConfig: VendingConfig
}

export default function AppPurchaseClient({ app, vendingConfig }: Props) {
  const t = useTranslations()

  // Need app vending configuration to initialize payment value
  const [manualAmount, setManualAmount] = useState<NumericInputValue | null>(
    null,
  )

  const vendingSetup = useGetAppVendingSetupVendingappAppIdSetupGet(app.id, {
    axios: { withCredentials: true },
    query: {
      enabled: !!app.id,
    },
  })

  const amount =
    manualAmount ??
    (vendingSetup.data
      ? {
          live: vendingSetup.data.data.recommended_donation / 100,
          settled: vendingSetup.data.data.recommended_donation / 100,
        }
      : { live: 0, settled: 0 })

  const setAmount = (newAmount: NumericInputValue) => {
    setManualAmount(newAmount)
  }

  if (vendingSetup.isError) {
    return (
      <>
        <h1 className="my-8 text-4xl font-extrabold">{t("whoops")}</h1>
        <p>{t(vendingSetup.error.message)}</p>
      </>
    )
  }

  if (vendingSetup.isPending) {
    return <Spinner size="s" />
  }

  const isDonationOnly = vendingSetup.data.data.minimum_payment === 0

  if (isDesktopAppstreamTypeGuard(app) === false) {
    return (
      <>
        <h1 className="my-8 text-4xl font-extrabold">{t("whoops")}</h1>
        <p>{t("vending.purchase-not-available")}</p>
      </>
    )
  }

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <LoginGuard>
        <h1 className="my-8 text-4xl font-extrabold">
          {t(isDonationOnly ? "kind-donate-app" : "kind-purchase-app", {
            appName: app?.name,
          })}
        </h1>
        <div
          className={clsx(
            "grid grid-cols-1 gap-x-8 gap-y-5 lg:mx-0 lg:max-w-none lg:grid-cols-3",
          )}
        >
          <ApplicationCard
            application={app}
            variant="nested"
            className="col-span-1 lg:col-span-2 h-min mt-5"
          />
          <div className="col-span-1">
            <AppVendingControls.PurchaseControls
              app={app}
              vendingConfig={vendingConfig}
              amount={amount}
              setAmount={setAmount}
              vendingSetup={vendingSetup.data.data}
            />
            <AppVendingControls.OwnershipTokenRedeemDialog app={app} />
          </div>
        </div>
      </LoginGuard>
    </div>
  )
}
