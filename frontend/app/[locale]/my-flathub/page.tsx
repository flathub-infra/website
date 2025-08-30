import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import MyFlathubClient from "./my-flathub-client"

export async function generateMetadata({
  params,
}: {
  params: { locale: string }
}): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("my-flathub"),
    robots: {
      index: false,
    },
  }
}

export default function MyFlathubPage({
  params,
}: {
  params: { locale: string }
}) {
  return <MyFlathubClient locale={params.locale} />
}
