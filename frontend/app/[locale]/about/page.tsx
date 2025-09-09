import { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { routing } from "src/i18n/routing"
import About from "./about"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })

  return {
    title: t("about-pagename"),
    description: t("about-description"),
  }
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Enable static rendering
  setRequestLocale(locale)

  return <About />
}
