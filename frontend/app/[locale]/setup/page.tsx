import { notFound } from "next/navigation"
import { fetchSetupInstructions } from "../../../src/distro-setup"
import { Metadata } from "next"
import SetupClient from "./setup-client"
import { getTranslations } from "next-intl/server"

export async function generateStaticParams() {
  return []
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("setup-flathub"),
    description: t("setup-flathub-description"),
  }
}

export default async function SetupPage() {
  const instructions = await fetchSetupInstructions()

  if (!instructions) {
    notFound()
  }

  return <SetupClient instructions={instructions} />
}
