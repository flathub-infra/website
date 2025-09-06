import { notFound } from "next/navigation"
import { fetchAppstream, fetchVendingConfig } from "../../../../../src/fetchers"
import { Metadata } from "next"
import PurchaseClient from "./purchase-client"
import { getTranslations } from "next-intl/server"

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

  // We'll need to check if it's donation only, but for now use a generic title
  // This will be refined in the client component
  const title = t("kind-purchase-app", { appName: app.name })

  return {
    title,
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
