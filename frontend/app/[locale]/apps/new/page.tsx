import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import NewAppClient from "./new-app-client"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })

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
