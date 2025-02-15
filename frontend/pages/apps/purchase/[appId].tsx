import { GetStaticPaths, GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import * as AppVendingControls from "../../../src/components/application/AppVendingControls"
import LoginGuard from "../../../src/components/login/LoginGuard"
import { fetchAppstream, fetchVendingConfig } from "../../../src/fetchers"
import { Appstream } from "../../../src/types/Appstream"
import clsx from "clsx"
import { ApplicationCard } from "src/components/application/ApplicationCard"
import {
  useGetAppVendingSetupVendingappAppIdSetupGet,
  VendingConfig,
} from "src/codegen"
import { useTranslation } from "next-i18next"
import { NumericInputValue } from "src/types/Input"
import { useState } from "react"
import Spinner from "src/components/Spinner"

export default function AppPurchasePage({
  app,
  vendingConfig,
}: {
  app: Appstream
  vendingConfig: VendingConfig
}) {
  const { t } = useTranslation()

  // Need app vending configuration to initialize payment value
  const [amount, setAmount] = useState<NumericInputValue>({
    live: 0,
    settled: 0,
  })

  const vendingSetup = useGetAppVendingSetupVendingappAppIdSetupGet(app.id, {
    axios: { withCredentials: true },
    query: {
      enabled: !!app.id,
      select: (setup) => {
        const decimalValue = setup.data.recommended_donation / 100
        setAmount({
          live: decimalValue,
          settled: decimalValue,
        })
        return setup
      },
    },
  })

  if (vendingSetup.isError) {
    return (
      <>
        <h1 className="my-8 text-4xl font-extrabold">{t("whoops")}</h1>
        <p>{t(vendingSetup.error.message)}</p>
      </>
    )
  }

  // Prevent control interaction while initalising and awaiting submission redirection
  if (vendingSetup.isPending) {
    return <Spinner size="s" />
  }

  // When the minimum payment is 0, the application does not require payment
  const isDonationOnly = vendingSetup.data.data.minimum_payment === 0

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo
        title={t(isDonationOnly ? "kind-donate-app" : "kind-purchase-app", {
          appName: app?.name,
        })}
        noindex
      />
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

export const getStaticProps: GetStaticProps = async ({
  locale,
  params: { appId },
}: {
  locale: string
  params: { appId: string }
}) => {
  const [app, vendingConfig] = await Promise.all([
    fetchAppstream(appId as string, locale),
    fetchVendingConfig(),
  ])

  return {
    notFound: !app,
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      app,
      vendingConfig,
    },
    revalidate: 900,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  }
}
