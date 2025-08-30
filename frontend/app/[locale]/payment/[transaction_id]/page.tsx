import { translationMessages } from "../../../../i18n/request"
import { Metadata } from "next"
import PaymentClient from "./payment-client"
import { getTranslations } from "next-intl/server"
import { getStripedataWalletStripedataGet } from "../../../../src/codegen"

interface Props {
  params: {
    transaction_id: string
    locale: string
  }
}

export async function generateMetadata(): Promise<Metadata> {
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
  const [stripeDataQuery, messages] = await Promise.all([
    getStripedataWalletStripedataGet(),
    translationMessages(params.locale),
  ])

  return (
    <PaymentClient 
      transactionId={params.transaction_id}
      stripePublicKey={stripeDataQuery.data.public_key}
      messages={messages}
    />
  )
}
