import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"

import { useMatomo } from "@mitresthen/matomo-tracker-react"
import { SearchPanel } from "src/components/search/SearchPanel"
import { usePostSearchSearchPost } from "src/codegen"

export default function Search({ locale }) {
  const { t } = useTranslation()
  const { trackSiteSearch } = useMatomo()

  const router = useRouter()
  const query = router.query

  const q = (query.q as string) || ""

  const filtersFromQuery = []
  if (query.runtime) {
    filtersFromQuery.push({
      filterType: "runtime",
      value: query.runtime as string,
    })
  }

  if (query.type) {
    filtersFromQuery.push({
      filterType: "type",
      value: query.type as string,
    })
  }

  const [selectedFilters, setSelectedFilters] = useState<
    {
      filterType: string
      value: string
    }[]
  >(filtersFromQuery)

  const search = usePostSearchSearchPost()

  useEffect(() => {
    search.mutate(
      {
        data: {
          query: q,
          filters: selectedFilters,
        },
      },
      {
        onSuccess: (res) => {
          if (q.length > 0) {
            trackSiteSearch({
              keyword: q,
              count: res.data.estimatedTotalHits,
            })
          }
          return res
        },
      },
    )
  }, [q, selectedFilters])

  return (
    <>
      <NextSeo
        title={t("search-for-query", { query: q })}
        noindex
        openGraph={{
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps/search?q=${q}`,
        }}
      />

      <div className="max-w-11/12 mx-auto my-0 mt-6 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <div className="flex flex-col gap-3 md:flex-row">
          <SearchPanel
            searchResult={search}
            selectedFilters={selectedFilters}
            setSelectedFilters={setSelectedFilters}
            query={q}
          />
        </div>
      </div>
    </>
  )
}

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      locale,
    },
  }
}
