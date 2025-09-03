import { Metadata } from "next"
import PaymentClient from "./payment-client"
import { getTranslations } from "next-intl/server"
import { getStripedataWalletStripedataGet } from "../../../../src/codegen"

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
    title: t("payment"),
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function PaymentPage({ params }: Props) {
  const { transaction_id } = await params
  const stripeDataQuery = await getStripedataWalletStripedataGet()

  return (
    <PaymentClient
      transactionId={transaction_id}
      stripePublicKey={stripeDataQuery.data.public_key}
    />
  )
}
