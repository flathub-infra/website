import { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { routing } from "src/i18n/routing"
import LanguagesClient from "./languages-client"

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
    title: t("languages"),
    description: t("languages-summary"),
  }
}

export default async function LanguagesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Enable static rendering
  setRequestLocale(locale)

  return <LanguagesClient />
}
