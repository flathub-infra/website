import { Trans, useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import Spinner from "src/components/Spinner"
import { useSearchQuery } from "../../../src/hooks/useSearchQuery"
import { FunctionComponent, useEffect, useState } from "react"
import {
  AppsIndex,
  MeilisearchResponseLimited,
  mapAppsIndexToAppstreamListItem,
} from "src/meilisearch"
import ApplicationCard from "src/components/application/ApplicationCard"
import { categoryToName, stringToCategory } from "src/types/Category"
import { Disclosure, Transition } from "@headlessui/react"
import { HiOutlineFunnel } from "react-icons/hi2"
import clsx from "clsx"
import Button from "src/components/Button"

interface Props {
  results: MeilisearchResponseLimited<AppsIndex>
}

const SearchResults: FunctionComponent<Props> = ({ results }) => {
  return (
    <div className="grid grid-cols-1 justify-around gap-4 md:grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
      {results.hits.map((app) => (
        <div key={app.app_id} className={"flex flex-col gap-2"}>
          <ApplicationCard application={mapAppsIndexToAppstreamListItem(app)} />
        </div>
      ))}
    </div>
  )
}

const SearchFilterCategories = ({
  categories,
  selectedFilters,
  setSelectedFilters,
}: {
  categories: MeilisearchResponseLimited<AppsIndex>["facetDistribution"]["categories"]
  selectedFilters: {
    filterType: string
    value: string
  }[]
  setSelectedFilters
}) => {
  const { t } = useTranslation()

  if (!categories) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-bold">{t("categories")}</h2>
      {Object.keys(categories).map((category) => (
        <div key={category}>
          <label className="flex items-center">
            <input
              type="checkbox"
              className="form-checkbox"
              checked={selectedFilters.some(
                (filter) =>
                  filter.filterType === "main_categories" &&
                  filter.value === category,
              )}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedFilters([
                    ...selectedFilters,
                    {
                      filterType: "main_categories",
                      value: category,
                    },
                  ])
                } else {
                  setSelectedFilters(
                    selectedFilters.filter(
                      (filter) =>
                        !(
                          filter.filterType === "main_categories" &&
                          filter.value === category
                        ),
                    ),
                  )
                }
              }}
            />
            <span className="ml-2">
              {`${categoryToName(stringToCategory(category), t)} (${
                categories[category]
              })`}
            </span>
          </label>
        </div>
      ))}
    </div>
  )
}

const SearchFilterFloss = ({
  isFreeLicense,
  selectedFilters,
  setSelectedFilters,
}: {
  isFreeLicense: MeilisearchResponseLimited<AppsIndex>["facetDistribution"]["is_free_license"]
  selectedFilters: {
    filterType: string
    value: string
  }[]
  setSelectedFilters
}) => {
  const { t } = useTranslation()

  if (!isFreeLicense) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-bold">{t("license")}</h2>
      {Object.keys(isFreeLicense)
        .sort((a, b) => {
          if (a === "true") {
            return -1
          }
          if (b === "true") {
            return 1
          }
          return 0
        })
        .map((license, i) => (
          <div key={`${license}-${i}`}>
            <label className="flex items-center">
              <input
                type="checkbox"
                className="form-checkbox"
                checked={selectedFilters.some(
                  (filter) =>
                    filter.filterType === "is_free_license" &&
                    filter.value === license,
                )}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedFilters([
                      ...selectedFilters,
                      {
                        filterType: "is_free_license",
                        value: license,
                      },
                    ])
                  } else {
                    setSelectedFilters(
                      selectedFilters.filter(
                        (filter) =>
                          !(
                            filter.filterType === "is_free_license" &&
                            filter.value === license
                          ),
                      ),
                    )
                  }
                }}
              />
              <span className="ml-2">{`${t(
                license === "true" ? "flos" : "proprietary",
              )} (${isFreeLicense[license]})`}</span>
            </label>
          </div>
        ))}
    </div>
  )
}

const SearchFilterVerified = ({
  verificationVerified,
  selectedFilters,
  setSelectedFilters,
}: {
  verificationVerified: MeilisearchResponseLimited<AppsIndex>["facetDistribution"]["verification_verified"]
  selectedFilters: {
    filterType: string
    value: string
  }[]
  setSelectedFilters
}) => {
  const { t } = useTranslation()

  if (!verificationVerified) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-bold">{t("verification")}</h2>
      {Object.keys(verificationVerified)
        .sort((a, b) => {
          if (a === "true") {
            return -1
          }
          if (b === "true") {
            return 1
          }
          return 0
        })
        .map((verified, i) => (
          <div key={`${verified}-${i}`}>
            <label className="flex items-center">
              <input
                type="checkbox"
                className="form-checkbox"
                checked={selectedFilters.some(
                  (filter) =>
                    filter.filterType === "verification_verified" &&
                    filter.value === verified,
                )}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedFilters([
                      ...selectedFilters,
                      {
                        filterType: "verification_verified",
                        value: verified,
                      },
                    ])
                  } else {
                    setSelectedFilters(
                      selectedFilters.filter(
                        (filter) =>
                          !(
                            filter.filterType === "verification_verified" &&
                            filter.value === verified
                          ),
                      ),
                    )
                  }
                }}
              />
              <span className="ml-2">{`${t(
                verified === "true" ? "verified" : "not-verified",
              )} (${verificationVerified[verified]})`}</span>
            </label>
          </div>
        ))}
    </div>
  )
}

const SearchFilters = ({
  results,
  selectedFilters,
  setSelectedFilters,
}: {
  results: MeilisearchResponseLimited<AppsIndex>
  selectedFilters: {
    filterType: string
    value: string
  }[]
  setSelectedFilters
}) => {
  const categories = results?.facetDistribution?.main_categories
  const isFreeLicense = results?.facetDistribution?.is_free_license
  const verificationVerified = results?.facetDistribution?.verification_verified

  return (
    <div className="flex min-w-[300px] flex-col gap-4">
      <SearchFilterCategories
        categories={categories}
        selectedFilters={selectedFilters}
        setSelectedFilters={setSelectedFilters}
      />
      <SearchFilterFloss
        isFreeLicense={isFreeLicense}
        selectedFilters={selectedFilters}
        setSelectedFilters={setSelectedFilters}
      />
      <SearchFilterVerified
        verificationVerified={verificationVerified}
        selectedFilters={selectedFilters}
        setSelectedFilters={setSelectedFilters}
      />
    </div>
  )
}

const SearchPanel = ({
  searchResult,
  selectedFilters,
  setSelectedFilters,
  query,
}) => {
  const { t } = useTranslation()

  if (!searchResult) {
    return (
      <div className="m-auto">
        <Spinner size="l" />
      </div>
    )
  }

  if (!searchResult || searchResult.estimatedTotalHits === 0) {
    return (
      <div>
        <span className="flex flex-col">
          <h1 className="text-2xl font-bold">
            {t("search-for-query", { query })}
          </h1>
        </span>
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
      </div>
    )
  }

  return (
    <>
      <div className="hidden flex-col gap-3 md:flex">
        <SearchFilters
          results={searchResult}
          selectedFilters={selectedFilters}
          setSelectedFilters={setSelectedFilters}
        />
      </div>
      <div className="flex flex-col gap-3">
        <span className="flex flex-col">
          <h1 className="text-2xl font-bold">
            {t("search-for-query", { query })}
          </h1>
          {searchResult && searchResult.estimatedTotalHits > 0 && (
            <span className="text-sm text-flathub-granite-gray dark:text-flathub-sonic-silver">
              {t("number-of-results", {
                number: searchResult.estimatedTotalHits,
              })}
            </span>
          )}
        </span>
        <div className="md:hidden">
          <Disclosure>
            {({ open }) => (
              <>
                <Disclosure.Button
                  as={Button}
                  variant="secondary"
                  className="w-full"
                >
                  <div className="flex gap-3">
                    <HiOutlineFunnel
                      className={clsx("h-6 w-6 transform duration-150")}
                    />
                    {t("filters")}
                  </div>
                </Disclosure.Button>
                <Transition
                  enter="transition duration-100 ease-out"
                  enterFrom="transform scale-95 opacity-0"
                  enterTo="transform scale-100 opacity-100"
                  leave="transition duration-75 ease-out"
                  leaveFrom="transform scale-100 opacity-100"
                  leaveTo="transform scale-95 opacity-0"
                >
                  <Disclosure.Panel className={"px-4"}>
                    <SearchFilters
                      results={searchResult}
                      selectedFilters={selectedFilters}
                      setSelectedFilters={setSelectedFilters}
                    />
                  </Disclosure.Panel>
                </Transition>
              </>
            )}
          </Disclosure>
        </div>
        <SearchResults results={searchResult} />
      </div>
    </>
  )
}

export default function Search() {
  const { t } = useTranslation()
  const router = useRouter()
  const { query } = router.query

  const [selectedFilters, setSelectedFilters] = useState<
    {
      filterType: string
      value: string
    }[]
  >([])

  const searchResult = useSearchQuery(query as string, selectedFilters)

  useEffect(() => {}, [selectedFilters])

  return (
    <>
      <NextSeo
        title={t("search-for-query", { query })}
        openGraph={{
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps/search/${query}`,
        }}
      />

      <div className="max-w-11/12 mx-auto my-0 mt-6 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <div className="flex flex-col gap-3 md:flex-row">
          <SearchPanel
            searchResult={searchResult}
            selectedFilters={selectedFilters}
            setSelectedFilters={setSelectedFilters}
            query={query}
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
    },
  }
}
