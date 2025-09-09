import { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import TermsAndConditionsClient from "./terms-and-conditions-client"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })

  return {
    title: t("terms-and-conditions"),
    description: t("terms-and-conditions-description"),
  }
}

export default async function TermsAndConditionsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Enable static rendering
  setRequestLocale(locale)

  return <TermsAndConditionsClient />
}
