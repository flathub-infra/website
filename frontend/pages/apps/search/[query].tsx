import { Trans, useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import Spinner from "src/components/Spinner"
import { useSearchQuery } from "../../../src/hooks/useSearchQuery"
import { useLocalStorage } from "../../../src/hooks/useLocalStorage"
import Toggle from "../../../src/components/Toggle"
import { FunctionComponent } from "react"
import {
  AppsIndex,
  MeilisearchResponseLimited,
  mapAppsIndexToAppstreamListItem,
} from "src/meilisearch"
import ApplicationCard from "src/components/application/ApplicationCard"

interface Props {
  results: MeilisearchResponseLimited<AppsIndex>
}

const SearchResults: FunctionComponent<Props> = ({ results }) => {
  const { t } = useTranslation()

  if (!results) {
    return <Spinner size="l" />
  }

  if (!results || results.estimatedTotalHits === 0) {
    return (
      <>
        <p>{t("could-not-find-match-for-search")}</p>
        <p>
          <Trans i18nKey={"common:request-new-app"}>
            If you&apos;re searching for a specific application, let the
            community know, that you want it on flathub
            <a
              target="_blank"
              rel="noreferrer"
              className="no-underline hover:underline"
              href="https://discourse.flathub.org/t/about-the-requests-category/22"
            >
              here
            </a>
            .
          </Trans>
        </p>
      </>
    )
  }

  return (
    <>
      <p>
        {t("number-of-results", {
          number: results.estimatedTotalHits,
        })}
      </p>

      <div className="grid grid-cols-1 justify-around gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-3">
        {results.hits.map((app) => (
          <div key={app.app_id} className={"flex flex-col gap-2"}>
            <ApplicationCard
              application={mapAppsIndexToAppstreamListItem(app)}
            />
          </div>
        ))}
      </div>
    </>
  )
}

export default function Search() {
  const { t } = useTranslation()
  const router = useRouter()
  const { query } = router.query
  const [freeSoftwareOnly, setFreeSoftwareOnly] = useLocalStorage(
    "search-free-software-only",
    false,
  )

  const searchResult = useSearchQuery(query as string, freeSoftwareOnly)

  return (
    <>
      <NextSeo
        title={t("search-for-query", { query })}
        openGraph={{
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps/search/${query}`,
        }}
      />

      <div className="max-w-11/12 mx-auto my-0 mt-6 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <span className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            {t("search-for-query", { query })}
          </h1>
          <div className="flex gap-3">
            <label>{t("free-software-only")}</label>
            <Toggle
              enabled={freeSoftwareOnly}
              setEnabled={setFreeSoftwareOnly}
            />
          </div>
        </span>
        <SearchResults results={searchResult} />
      </div>
    </>
  )
}

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  }
}
