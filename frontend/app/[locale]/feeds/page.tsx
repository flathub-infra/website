import { getTranslations } from "next-intl/server"
import FeedsClient from "./feeds-client"
import { Metadata } from "next"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("rss-feeds"),
    description: t("rss-feeds-description"),
  }
}

export async function generateStaticParams() {
  return []
}

export default function FeedsPage() {
  return <FeedsClient />
}
