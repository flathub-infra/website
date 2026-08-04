import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import About from "./about-client"

export const dynamic = "force-static"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations()

  return {
    title: t("about-pagename"),
    description: t("about-description"),
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/${locale}/about`,
    },
  }
}

export default function AboutPage() {
  return <About />
}
