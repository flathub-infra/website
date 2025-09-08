import { notFound } from "next/navigation"
import { fetchAppstream, fetchVendingConfig } from "../../../../../src/fetchers"
import { Metadata } from "next"
import PurchaseClient from "./purchase-client"
import { getTranslations } from "next-intl/server"
import { getAppVendingSetupVendingappAppIdSetupGet } from "src/codegen"

interface Props {
  params: Promise<{
    appId: string
    locale: string
  }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations()
  const { appId, locale } = await params
  const app = await fetchAppstream(appId, locale)

  if (!app) {
    return {
      title: t("whoops"),
    }
  }

  const vendingSetup = await getAppVendingSetupVendingappAppIdSetupGet(app.id, {
    withCredentials: true,
  })

  // When the minimum payment is 0, the application does not require payment
  const isDonationOnly = vendingSetup.data.minimum_payment === 0

  return {
    title: t(isDonationOnly ? "kind-donate-app" : "kind-purchase-app", {
      appName: app?.name,
    }),
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function PurchasePage({ params }: Props) {
  const { appId, locale } = await params
  const [app, vendingConfig] = await Promise.all([
    fetchAppstream(appId, locale),
    fetchVendingConfig(),
  ])

  if (!app) {
    notFound()
  }

  return <PurchaseClient app={app} vendingConfig={vendingConfig} />
}
