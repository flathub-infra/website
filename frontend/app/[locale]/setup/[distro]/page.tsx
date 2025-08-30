import { notFound } from "next/navigation"
import { fetchSetupInstructions } from "../../../../src/distro-setup"
import { translationMessages } from "../../../../i18n/request"
import { Metadata } from "next"
import DistroSetupClient from "./distro-setup-client"
import { getTranslations } from "next-intl/server"

interface Props {
  params: {
    distro: string
    locale: string
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const instructions = await fetchSetupInstructions()
  const t = await getTranslations()
  
  let distroData = instructions.find(
    (instruction) => instruction.name === params.distro,
  )

  if (!distroData) {
    distroData = instructions.find((instruction) => instruction.slug === params.distro)
  }

  if (!distroData) {
    return {
      title: t("setup-flathub"),
    }
  }

  const translatedDistroName = t(distroData.translatedNameKey)

  return {
    title: t("distribution-flathub-setup", {
      distribution: translatedDistroName,
    }),
    description: t("setup-flathub-description"),
    robots: params.locale === "en-GB" ? { index: false } : undefined,
  }
}

export default async function DistroSetupPage({ params }: Props) {
  const [instructions, messages] = await Promise.all([
    fetchSetupInstructions(),
    translationMessages(params.locale),
  ])

  let distroData = instructions.find(
    (instruction) => instruction.name === params.distro,
  )

  if (!distroData) {
    distroData = instructions.find((instruction) => instruction.slug === params.distro)
  }

  if (!distroData) {
    notFound()
  }

  return (
    <DistroSetupClient 
      distroData={distroData} 
      locale={params.locale}
      messages={messages}
    />
  )
}
