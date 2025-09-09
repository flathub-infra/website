import { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import DonateClient from "./donate-client"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })

  return {
    title: t("donate-to", { project: "Flathub" }),
    robots: {
      index: false,
    },
  }
}

export default async function DonatePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  // Enable static rendering
  setRequestLocale(locale)
  return <DonateClient />
}
