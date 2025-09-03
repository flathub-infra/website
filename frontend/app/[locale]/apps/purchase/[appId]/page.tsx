import { notFound } from "next/navigation"
import { fetchAppstream, fetchVendingConfig } from "../../../../../src/fetchers"
import { Metadata } from "next"
import AppPurchaseClient from "./app-purchase-client"
import { getTranslations } from "next-intl/server"
import { useGetAppVendingSetupVendingappAppIdSetupGet } from "src/codegen/vending/vending"

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

  if (!app) {
    return {
      title: t("whoops"),
    }
  }

  const vendingSetup = useGetAppVendingSetupVendingappAppIdSetupGet(app.id, {
    axios: { withCredentials: true },
    query: {
      enabled: !!app.id,
    },
  })

  // When the minimum payment is 0, the application does not require payment
  const isDonationOnly = vendingSetup.data.data.minimum_payment === 0

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

  if (!app) {
    notFound()
  }

  return <AppPurchaseClient app={app} vendingConfig={vendingConfig} />
}
