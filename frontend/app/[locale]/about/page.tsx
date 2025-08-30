import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import AboutClient from "./about-client"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })

  return {
    title: t("about-pagename"),
    description: t("about-description"),
    openGraph: {
      url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/about`,
    },
    robots: {
      index: locale !== "en-GB",
    },
  }
}

export default function AboutPage() {
  return <AboutClient />
}
