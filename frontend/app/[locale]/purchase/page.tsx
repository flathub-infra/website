import { Metadata } from "next"
import PurchaseWorkflowClient from "./purchase-workflow-client"
import { getTranslations } from "next-intl/server"

interface Props {
  params: Promise<{
    locale: string
  }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations()

  return {
    title: t("purchase-apps-title"),
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function PurchasePage({ params }: Props) {
  return <PurchaseWorkflowClient />
}
