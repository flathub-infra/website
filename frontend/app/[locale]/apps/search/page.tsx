import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import SearchClient from "./search-client"
import Spinner from "src/components/Spinner"

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}): Promise<Metadata> {
  const t = await getTranslations()
  const q = (await searchParams).q || ""

  return {
    title: t("search-for-query", { query: q }),
    openGraph: {
      url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps/search?q=${q}`,
    },
    robots: { index: false },
  }
}

export default function SearchPage() {
  return (
    <Suspense fallback={<Spinner size={"m"} />}>
      <SearchClient />
    </Suspense>
  )
}
