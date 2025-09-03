import { notFound } from "next/navigation"
import { fetchAppstream, fetchVendingConfig } from "../../../../../src/fetchers"
import { Metadata } from "next"
import AppPurchaseClient from "./app-purchase-client"
import { getTranslations } from "next-intl/server"

interface Props {
  params: Promise<{
    appId: string
    locale: string
  }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { appId, locale } = await params
  const app = await fetchAppstream(appId, locale)

  if (!app) {
    const t = await getTranslations()
    return {
      title: t("whoops"),
    }
  }

  // We need to determine if it's donation-only on the server side for proper metadata
  // For now, we'll use a generic title that covers both cases
  const t = await getTranslations()
  const title = t("kind-purchase-app", { appName: app.name })

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
