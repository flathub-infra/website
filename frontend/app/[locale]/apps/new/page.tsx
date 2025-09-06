import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import NewAppClient from "./new-app-client"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("new-app"),
    robots: {
      index: false,
    },
  }
}

export default function NewAppPage() {
  return <NewAppClient />
}
