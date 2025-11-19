import { getTranslations, setRequestLocale } from "next-intl/server"
import { staticLocales } from "src/i18n/static-locales"
import FeedsClient from "./feeds-client"
import { Metadata } from "next"

export function generateStaticParams() {
  return staticLocales.map((locale) => ({ locale }))
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
