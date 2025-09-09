import { notFound } from "next/navigation"
import { fetchSetupInstructions } from "../../../src/distro-setup"
import { Metadata } from "next"
import SetupClient from "./setup-client"
import { getTranslations, setRequestLocale } from "next-intl/server"

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
