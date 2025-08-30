import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import PrivacyPolicyClient from "./privacy-policy-client"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })

  return {
    title: t("privacy-policy"),
    description: t("privacy-policy-description"),
    openGraph: {
      url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/privacy-policy`,
    },
    robots: {
      index: locale !== "en-GB",
    },
  }
}

export default function PrivacyPolicyPage() {
  return <PrivacyPolicyClient />
}
