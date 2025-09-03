import { notFound } from "next/navigation"
import { fetchSetupInstructions } from "../../../src/distro-setup"
import { Metadata } from "next"
import SetupClient from "./setup-client"
import { getTranslations } from "next-intl/server"

interface Props {
  params: Promise<{
    locale: string
  }>
}

export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations()

  return {
    title: t("setup-flathub"),
    description: t("setup-flathub-description"),
    robots: locale === "en-GB" ? { index: false } : undefined,
  }
}

export default async function SetupPage() {
  const instructions = await fetchSetupInstructions()

  if (!instructions) {
    notFound()
  }

  return <SetupClient instructions={instructions} />
}
