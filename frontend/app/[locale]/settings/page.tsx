import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { fetchLoginProviders } from "../../../src/fetchers"
import SettingsClient from "./settings-client"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })

  return {
    title: t("settings"),
    robots: {
      index: false,
    },
  }
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  
  try {
    const providers = await fetchLoginProviders()

    return <SettingsClient providers={providers} />
  } catch (error) {
    notFound()
  }
}
