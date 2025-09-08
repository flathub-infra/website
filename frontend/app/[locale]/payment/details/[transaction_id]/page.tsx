import { Metadata } from "next"
import PaymentDetailsClient from "./payment-details-client"
import { getTranslations } from "next-intl/server"

interface Props {
  params: Promise<{
    transaction_id: string
    locale: string
  }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
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
  const { transaction_id } = await params
  return <PaymentDetailsClient transactionId={transaction_id} />
}
