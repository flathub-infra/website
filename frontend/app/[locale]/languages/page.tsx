import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import LanguagesClient from "./languages-client"

export async function generateMetadata({
  params,
}: {
  params: { locale: string }
}): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("languages"),
    description: t("languages-summary"),
    openGraph: {
      url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/languages`,
    },
    robots: {
      index: params.locale !== "en-GB",
    },
  }
}

export default function LanguagesPage({
  params,
}: {
  params: { locale: string }
}) {
  return <LanguagesClient locale={params.locale} />
}
