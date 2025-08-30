import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import SearchClient from "./search-client"

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })
  const q = (await searchParams).q || ""

  return {
    title: t("search-for-query", { query: q }),
    description: t("search-apps-index-description"),
    openGraph: {
      url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps/search?q=${q}`,
    },
    robots: { index: false },
  }
}

export default function SearchPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  return <SearchClient />
}
