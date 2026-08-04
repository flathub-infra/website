import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { staticLocales } from "src/i18n/static-locales"
import LanguagesClient from "./languages-client"

export const dynamic = "force-static"

export function generateStaticParams() {
  return staticLocales.map((locale) => ({ locale }))
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("languages"),
    description: t("languages-summary"),
  }
}

export default function LanguagesPage() {
  return <LanguagesClient />
}
