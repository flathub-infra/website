import { getTranslations } from "next-intl/server"
import { staticLocales } from "src/i18n/static-locales"
import FeedsClient from "./feeds-client"
import { Metadata } from "next"

export const dynamic = "force-static"

export function generateStaticParams() {
  return staticLocales.map((locale) => ({ locale }))
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("rss-feeds"),
    description: t("rss-feeds-description"),
  }
}

export default function FeedsPage() {
  return <FeedsClient />
}
