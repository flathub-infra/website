import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import BadgesClient from "./badges-client"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("official-badges"),
    description: t("badges-description"),
  }
}

export async function generateStaticParams() {
  return []
}

export default function BadgesPage() {
  return <BadgesClient />
}
