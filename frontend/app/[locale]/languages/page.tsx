import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import LanguagesClient from "./languages-client"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("languages"),
    description: t("languages-summary"),
  }
}

export async function generateStaticParams() {
  return []
}

export default async function LanguagesPage() {
  return <LanguagesClient />
}
