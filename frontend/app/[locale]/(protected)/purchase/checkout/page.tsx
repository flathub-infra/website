import { Metadata } from "next"
import CheckoutClient from "./checkout-client"
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
    title: t("checkout"),
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function CheckoutPage({ params }: Props) {
  return <CheckoutClient />
}
