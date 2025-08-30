import { notFound } from "next/navigation"
import { fetchAppstream, fetchVendingConfig } from "../../../../../src/fetchers"
import { translationMessages } from "../../../../../i18n/request"
import { Metadata } from "next"
import PurchaseClient from "./purchase-client"
import { getTranslations } from "next-intl/server"

interface Props {
  params: {
    appId: string
    locale: string
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations()
  const app = await fetchAppstream(params.appId, params.locale)

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
  const [app, vendingConfig, messages] = await Promise.all([
    fetchAppstream(params.appId, params.locale),
    fetchVendingConfig(),
    translationMessages(params.locale),
  ])

  if (!app) {
    notFound()
  }

  return (
    <PurchaseClient 
      app={app} 
      vendingConfig={vendingConfig} 
      messages={messages}
    />
  )
}
