import { useTranslations } from "next-intl"
import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import ServerErrorClient from "./server-error-client"

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
    },
  }
}

export default async function ServerErrorPage() {
  return <ServerErrorClient />
}
