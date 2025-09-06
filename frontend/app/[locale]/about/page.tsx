import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import About from "./about"

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
  }
}

export async function generateStaticParams() {
  return []
}

export default function AboutPage() {
  return <About />
}
