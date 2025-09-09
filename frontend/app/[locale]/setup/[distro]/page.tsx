import { notFound } from "next/navigation"
import { fetchSetupInstructions } from "../../../../src/distro-setup"
import { Metadata } from "next"
import DistroSetupClient from "./distro-setup-client"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { languages } from "../../../../src/localize"

interface Props {
  params: Promise<{
    distro: string
    locale: string
  }>
}

export async function generateStaticParams() {
  const instructions = await fetchSetupInstructions()
  const staticParams = []

  // Generate params for each locale and each distro
  for (const locale of languages) {
    for (const instruction of instructions) {
      // Add params for the main distro name
      staticParams.push({
        locale,
        distro: instruction.name,
      })

      // Add params for the slug if it exists
      if (instruction.slug) {
        staticParams.push({
          locale,
          distro: instruction.slug,
        })
      }
    }
  }

  return staticParams
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { distro, locale } = await params
  const cleanedDistro = distro.replaceAll("%20", " ")
  const instructions = await fetchSetupInstructions()
  const t = await getTranslations({ locale })

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

  // Enable static rendering
  setRequestLocale(locale)

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
