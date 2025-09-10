import { notFound } from "next/navigation"
import { fetchAppstream, fetchVendingConfig } from "../../../../../src/fetchers"
import { Metadata } from "next"
import AppPurchaseClient from "./app-purchase-client"
import { getTranslations } from "next-intl/server"
import { getAppVendingSetupVendingappAppIdSetupGet } from "src/codegen/vending/vending"

interface Props {
  params: Promise<{
    appId: string
    locale: string
  }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { appId, locale } = await params
  const app = await fetchAppstream(appId, locale)
  const t = await getTranslations()

  if ("error" in app || !app) {
    return {
      title: t("whoops"),
    }
  }

  const vendingSetup = await getAppVendingSetupVendingappAppIdSetupGet(app.id, {
    credentials: "include",
  })

  // When the minimum payment is 0, the application does not require payment
  const isDonationOnly =
    vendingSetup.status === 200 && vendingSetup.data.minimum_payment === 0

  const title = t(isDonationOnly ? "kind-donate-app" : "kind-purchase-app", {
    appName: app?.name,
  })

  return {
    title,
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function AppPurchasePage({ params }: Props) {
  const { appId, locale } = await params
  const [app, vendingConfig] = await Promise.all([
    fetchAppstream(appId, locale),
    fetchVendingConfig(),
  ])

  if ("error" in app || !app) {
    notFound()
  }

  if ("error" in vendingConfig) {
    throw new Error("Vending config not found")
  }

  return <AppPurchaseClient app={app} vendingConfig={vendingConfig} />
}
