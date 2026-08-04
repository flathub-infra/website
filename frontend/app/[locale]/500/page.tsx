import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { staticLocales } from "src/i18n/static-locales"
import ServerErrorClient from "./server-error-client"

export const dynamic = "force-static"

export function generateStaticParams() {
  return staticLocales.map((locale) => ({ locale }))
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("server-error"),
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default function ServerErrorPage() {
  return <ServerErrorClient />
}
