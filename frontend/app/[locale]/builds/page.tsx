import { Metadata } from "next"
import { setRequestLocale } from "next-intl/server"
import BuildsClient from "./builds-client"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Builds",
    description: "Monitor build and deployment processes",
    robots: {
      index: false,
    },
  }
}

export default async function BuildsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Enable static rendering
  setRequestLocale(locale)

  return <BuildsClient />
}
