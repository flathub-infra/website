import { notFound } from "next/navigation"
import { fetchSetupInstructions } from "../../../../src/distro-setup"
import { Metadata } from "next"
import DistroSetupClient from "./distro-setup-client"
import { getTranslations } from "next-intl/server"

interface Props {
  params: Promise<{
    distro: string
    locale: string
  }>
}

export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { distro } = await params
  const cleanedDistro = distro.replaceAll("%20", " ")
  const instructions = await fetchSetupInstructions()
  const t = await getTranslations()

  let distroData = instructions.find(
    (instruction) => instruction.name === cleanedDistro,
  )

  if (!distroData) {
    distroData = instructions.find(
      (instruction) => instruction.slug === cleanedDistro,
    )
  }

  if (!distroData) {
    return {
      title: t("setup-flathub"),
    }
  }

  const translatedDistroName = t(distroData.translatedNameKey)

  return {
    title: t("distribution-flathub-setup", {
      distribution: translatedDistroName || cleanedDistro,
    }),
    description: t("setup-flathub-description"),
  }
}

export default async function DistroSetupPage({ params }: Props) {
  const { distro, locale } = await params
  const cleanedDistro = distro.replaceAll("%20", " ")
  const instructions = await fetchSetupInstructions()

  let distroData = instructions.find(
    (instruction) => instruction.name === cleanedDistro,
  )

  if (!distroData) {
    distroData = instructions.find(
      (instruction) => instruction.slug === cleanedDistro,
    )
  }

  if (!distroData) {
    notFound()
  }

  return <DistroSetupClient distroData={distroData} locale={locale} />
}
