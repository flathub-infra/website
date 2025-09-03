import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import PrivacyPolicyClient from "./privacy-policy-client"

export async function generateStaticParams() {
  return []
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("privacy-policy"),
    description: t("privacy-policy-description"),
  }
}

export default function PrivacyPolicyPage() {
  return <PrivacyPolicyClient />
}
