import { notFound } from "next/navigation"
import { fetchAppstream, fetchVendingConfig } from "../../../../../src/fetchers"
import { translationMessages } from "../../../../../i18n/request"
import { Metadata } from "next"
import ManageClient from "./manage-client"
import { getTranslations } from "next-intl/server"

interface Props {
  params: {
    appId: string
    locale: string
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const app = await fetchAppstream(params.appId, params.locale)
  const appName = app?.name || params.appId

  return {
    title: appName,
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function ManagePage({ params }: Props) {
  const [app, vendingConfig, messages] = await Promise.all([
    fetchAppstream(params.appId, params.locale),
    fetchVendingConfig(),
    translationMessages(params.locale),
  ])

  // For manage pages, we allow fallback to show the app ID if app doesn't exist
  const appData = app ?? { id: params.appId, name: params.appId }

  return (
    <ManageClient 
      app={appData} 
      vendingConfig={vendingConfig} 
      messages={messages}
    />
  )
}
