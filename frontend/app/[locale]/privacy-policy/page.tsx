import { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { routing } from "src/i18n/routing"
import PrivacyPolicyClient from "./privacy-policy-client"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })

  return {
    title: t("privacy-policy"),
    description: t("privacy-policy-description"),
  }
}

export default async function PrivacyPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Enable static rendering
  setRequestLocale(locale)

  return <PrivacyPolicyClient />
}
