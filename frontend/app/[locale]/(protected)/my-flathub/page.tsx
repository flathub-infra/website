import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import MyFlathubClient from "./my-flathub-client"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("my-flathub"),
    robots: {
      index: false,
    },
  }
}

export default async function MyFlathubPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  return <MyFlathubClient locale={locale} />
}
