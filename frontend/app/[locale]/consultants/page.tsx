import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import ConsultantsClient from "./consultants-client"

export async function generateStaticParams() {
  return []
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("consultants"),
    description: t("consultants-description"),
  }
}

export default function ConsultantsPage() {
  return <ConsultantsClient />
}
