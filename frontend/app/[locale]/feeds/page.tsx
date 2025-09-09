import { getTranslations, setRequestLocale } from "next-intl/server"
import { routing } from "src/i18n/routing"
import FeedsClient from "./feeds-client"
import { Metadata } from "next"

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })

  return {
    title: t("rss-feeds"),
    description: t("rss-feeds-description"),
  }
}

export default async function FeedsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Enable static rendering
  setRequestLocale(locale)

  return <FeedsClient />
}
