import { translationMessages } from "../../../../../i18n/request"
import { Metadata } from "next"
import PaymentDetailsClient from "./payment-details-client"
import { getTranslations } from "next-intl/server"

interface Props {
  params: {
    transaction_id: string
    locale: string
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  
  return {
    title: t("transaction-summary"),
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function PaymentDetailsPage({ params }: Props) {
  const messages = await translationMessages(params.locale)

  return (
    <PaymentDetailsClient 
      transactionId={params.transaction_id}
      messages={messages}
    />
  )
}
