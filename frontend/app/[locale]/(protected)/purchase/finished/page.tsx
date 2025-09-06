import { Metadata } from "next"
import PurchaseFinishedClient from "./purchase-finished-client"
import { getTranslations } from "next-intl/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("thank-you-for-your-purchase"),
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function PurchaseFinishedPage() {
  return <PurchaseFinishedClient />
}
