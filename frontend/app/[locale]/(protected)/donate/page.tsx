import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import DonateClient from "./donate-client"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("donate-to", { project: "Flathub" }),
    robots: {
      index: false,
    },
  }
}

export default function DonatePage() {
  return <DonateClient />
}
