import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import About from "./about"

export async function generateMetadata(): Promise<Metadata> {
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
