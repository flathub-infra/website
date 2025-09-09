import { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import ConsultantsClient from "./consultants-client"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })

  return {
    title: t("consultants"),
    description: t("consultants-description"),
  }
}

export default async function ConsultantsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Enable static rendering
  setRequestLocale(locale)

  return <ConsultantsClient />
}
