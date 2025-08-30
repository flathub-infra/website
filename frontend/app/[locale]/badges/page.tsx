import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import BadgesClient from "./badges-client"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })

  return {
    title: t("official-badges"),
    description: t("badges-description"),
    openGraph: {
      url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/badges`,
    },
    robots: {
      index: locale !== "en-GB",
    },
  }
}

export default function BadgesPage() {
  return <BadgesClient />
}
