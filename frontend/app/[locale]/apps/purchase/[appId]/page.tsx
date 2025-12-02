import { notFound } from "next/navigation"
import {
  getAppstreamAppstreamAppIdGet,
  getGlobalVendingConfigVendingConfigGet,
  getStorefrontInfoPurchasesStorefrontInfoGet,
} from "../../../../../src/codegen"
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
  const t = await getTranslations()
  const { appId, locale } = await params
  const response = await getAppstreamAppstreamAppIdGet(appId, { locale })
  const app = response.data

  const storefrontInfo = await getStorefrontInfoPurchasesStorefrontInfoGet({
    app_id: app.id,
  })

  // When the minimum payment is 0 or not set, the application does not require payment
  const isDonationOnly = !storefrontInfo.data.pricing?.minimum_payment

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

  return <AppPurchaseClient app={app} vendingConfig={vendingConfig} />
}
