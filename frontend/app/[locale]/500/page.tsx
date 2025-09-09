import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import ServerErrorClient from "./server-error-client"

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

export default async function ServerErrorPage() {
  return <ServerErrorClient />
}
