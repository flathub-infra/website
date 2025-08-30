import { translationMessages } from "../../../i18n/request"
import { Metadata } from "next"
import PurchaseWorkflowClient from "./purchase-workflow-client"
import { getTranslations } from "next-intl/server"

interface Props {
  params: {
    locale: string
  }
}

export async function generateMetadata(): Promise<Metadata> {
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
  const messages = await translationMessages(params.locale)

  return (
    <PurchaseWorkflowClient messages={messages} />
  )
}
