import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import TermsAndConditionsClient from "./terms-and-conditions-client"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })

  return {
    title: t("terms-and-conditions"),
    description: t("terms-and-conditions-description"),
    openGraph: {
      url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/terms-and-conditions`,
    },
    robots: {
      index: locale !== "en-GB",
    },
  }
}

export default function TermsAndConditionsPage() {
  return <TermsAndConditionsClient />
}
