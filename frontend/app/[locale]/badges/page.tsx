import { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { routing } from "src/i18n/routing"
import BadgesClient from "./badges-client"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })

  return {
    title: t("official-badges"),
    description: t("badges-description"),
  }
}

export default async function BadgesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Enable static rendering
  setRequestLocale(locale)

  return <BadgesClient />
}
