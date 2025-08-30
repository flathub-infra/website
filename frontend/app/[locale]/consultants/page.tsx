import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import ConsultantsClient from "./consultants-client"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })

  return {
    title: t("consultants"),
    description: t("consultants-description"),
    openGraph: {
      url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/consultants`,
    },
    robots: {
      index: locale !== "en-GB",
    },
  }
}

export default function ConsultantsPage() {
  return <ConsultantsClient />
}
