import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import PublisherAgreementClient from "./publisher-agreement-client"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("publisher-agreement"),
    robots: {
      index: false,
    },
  }
}

export default function PublisherAgreementPage() {
  return <PublisherAgreementClient />
}
