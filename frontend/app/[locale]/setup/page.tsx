import { notFound } from "next/navigation"
import { fetchSetupInstructions } from "../../../src/distro-setup"
import { translationMessages } from "../../../i18n/request"
import { Metadata } from "next"
import SetupClient from "./setup-client"
import { getTranslations } from "next-intl/server"

interface Props {
  params: {
    locale: string
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations()
  
  return {
    title: t("setup-flathub"),
    description: t("setup-flathub-description"),
    robots: params.locale === "en-GB" ? { index: false } : undefined,
  }
}

export default async function SetupPage({ params }: Props) {
  const [instructions, messages] = await Promise.all([
    fetchSetupInstructions(),
    translationMessages(params.locale),
  ])

  if (!instructions) {
    notFound()
  }

  return (
    <SetupClient 
      instructions={instructions} 
      locale={params.locale}
      messages={messages}
    />
  )
}
