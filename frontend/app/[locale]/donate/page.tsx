import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import DonateClient from "./donate-client"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })

  return {
    title: t("donate-to", { project: "Flathub" }),
    openGraph: {
      url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/donate`,
    },
    robots: {
      index: false,
    },
  }
}

export default function DonatePage() {
  return <DonateClient />
}
