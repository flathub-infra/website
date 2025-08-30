import { translationMessages } from "../../../../i18n/request"
import { Metadata } from "next"
import CheckoutClient from "./checkout-client"
import { getTranslations } from "next-intl/server"

interface Props {
  params: {
    locale: string
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  
  return {
    title: t("checkout"),
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function CheckoutPage({ params }: Props) {
  const messages = await translationMessages(params.locale)

  return (
    <CheckoutClient messages={messages} />
  )
}
