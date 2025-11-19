import { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { staticLocales } from "src/i18n/static-locales"
import ServerErrorClient from "./server-error-client"

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
    title: t("server-error"),
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function ServerErrorPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Enable static rendering
  setRequestLocale(locale)

  return <ServerErrorClient />
}
