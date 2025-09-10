import { notFound } from "next/navigation"
import { fetchSetupInstructions } from "../../../src/distro-setup"
import { Metadata } from "next"
import SetupClient from "./setup-client"
import { getTranslations, setRequestLocale } from "next-intl/server"

export const dynamic = "force-static"
export const revalidate = 43200 // Revalidate twice per day (12 hours)

export async function generateStaticParams() {
  return []
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })

  return {
    title: t("setup-flathub"),
    description: t("setup-flathub-description"),
  }
}

export default async function SetupPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Enable static rendering
  setRequestLocale(locale)

  const instructions = await fetchSetupInstructions()

  if (!instructions) {
    notFound()
  }

  return <SetupClient instructions={instructions} />
}
