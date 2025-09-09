import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import TermsAndConditionsClient from "./terms-and-conditions-client"

export async function generateStaticParams() {
  return []
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("terms-and-conditions"),
    description: t("terms-and-conditions-description"),
  }
}

export default function TermsAndConditionsPage() {
  return <TermsAndConditionsClient />
}
