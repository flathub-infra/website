import { notFound } from "next/navigation"
import {
  getAppstreamAppstreamAppIdGet,
  getGlobalVendingConfigVendingConfigGet,
} from "../../../../../src/codegen"
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
  const response = await getAppstreamAppstreamAppIdGet(appId, { locale })
  const app = response.data
  const t = await getTranslations()

  const vendingSetup = await getAppVendingSetupVendingappAppIdSetupGet(app.id, {
    withCredentials: true,
  })

  // When the minimum payment is 0, the application does not require payment
  const isDonationOnly = vendingSetup.data.minimum_payment === 0

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
  const [appResponse, vendingConfigResponse] = await Promise.all([
    getAppstreamAppstreamAppIdGet(appId, { locale }),
    getGlobalVendingConfigVendingConfigGet(),
  ])

  if (appResponse.status !== 200 || !appResponse.data) {
    notFound()
  }

  const app = appResponse.data
  const vendingConfig = vendingConfigResponse.data

  return <AppPurchaseClient app={app as any} vendingConfig={vendingConfig} />
}
