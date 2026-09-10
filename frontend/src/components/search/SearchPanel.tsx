import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Transition,
} from "@headlessui/react"
import { FunnelIcon } from "@heroicons/react/24/outline"
import clsx from "clsx"
import { SearchFilters } from "src/components/search/SearchFilters"
import { UseMutationResult } from "@tanstack/react-query"
import { AxiosResponse } from "axios"
import { SearchResults } from "./SearchResults"
import { Button } from "@/components/ui/button"
import { MeilisearchResponseAppsIndex, AppsIndex } from "src/codegen"
import { useTranslations } from "next-intl"

export const SearchPanel = ({
  searchResult,
  selectedFilters,
  setSelectedFilters,
  query,
  allHits,
  searchMetadata,
  hasNextPage,
  isLoadingMore,
  isInitialLoading,
  fetchNextPage,
  recommendations,
  isRecommendationsLoading,
  clearFilters,
  retrySearch,
}: {
  searchResult: UseMutationResult<
    AxiosResponse<MeilisearchResponseAppsIndex, any>,
    unknown
  >
  selectedFilters: {
    filterType: string
    value: string
  }[]
  setSelectedFilters
  query: string
  allHits: AppsIndex[]
  searchMetadata: Omit<MeilisearchResponseAppsIndex, "hits"> | null
  hasNextPage: boolean
  isLoadingMore: boolean
  isInitialLoading: boolean
  fetchNextPage: () => void
  recommendations: AppsIndex[]
  isRecommendationsLoading: boolean
  clearFilters: () => void
  retrySearch: () => void
}) => {
  const t = useTranslations()

  const isNoMatch =
    query.trim().length > 0 &&
    !isInitialLoading &&
    searchResult.isSuccess &&
    searchMetadata?.totalHits === 0
  const hasSelectedFilters = selectedFilters.length > 0

  return (
    <>
      <div className="hidden flex-col gap-3 md:flex">
        <SearchFilters
          results={searchResult}
          selectedFilters={selectedFilters}
          setSelectedFilters={setSelectedFilters}
        />
      </div>
      <div className="flex w-full flex-col gap-3">
        <span className="flex flex-col">
          <h1 className="text-2xl font-bold">
            {t("search-for-query", { query })}
          </h1>
          {
            <span
              className={clsx(
                searchResult.isPending && "blur-xs",
                "text-sm text-flathub-granite-gray dark:text-flathub-sonic-silver transition",
              )}
            >
              {t("number-of-results", {
                number:
                  searchMetadata?.totalHits ??
                  searchResult.data?.data?.totalHits ??
                  "000",
              })}
            </span>
          }
        </span>
        <div className="md:hidden">
          <Disclosure>
            <DisclosureButton
              as={Button}
              size="lg"
              disabled={searchResult.isPending}
              variant="secondary"
              className="w-full"
            >
              <div className="flex gap-3">
                <FunnelIcon className={"size-6 transform duration-150"} />
                {t("filters")}
              </div>
            </DisclosureButton>
            <Transition
              enter="transition duration-100 ease-out"
              enterFrom="transform scale-95 opacity-0"
              enterTo="transform scale-100 opacity-100"
              leave="transition duration-75 ease-out"
              leaveFrom="transform scale-100 opacity-100"
              leaveTo="transform scale-95 opacity-0"
            >
              <DisclosurePanel className={"px-4"}>
                <SearchFilters
                  results={searchResult}
                  selectedFilters={selectedFilters}
                  setSelectedFilters={setSelectedFilters}
                />
              </DisclosurePanel>
            </Transition>
          </Disclosure>
        </div>
        {searchResult.isError && (
          <div className="flex flex-col gap-3">
            <p role="alert">{t("network-error-try-again")}</p>
            <Button
              onClick={retrySearch}
              variant="secondary"
              size="lg"
              className="w-fit"
            >
              {t("try-again")}
            </Button>
          </div>
        )}
        {isNoMatch && (
          <div className="flex flex-col gap-3">
            <p role="status" aria-live="polite">
              {t(
                hasSelectedFilters
                  ? "could-not-find-match-with-filters"
                  : "could-not-find-match-for-search",
              )}
            </p>
            {recommendations.length > 0 && (
              <p>
                {t(
                  hasSelectedFilters
                    ? "popular-apps-with-filters"
                    : "popular-apps-to-explore",
                )}
              </p>
            )}
            {isRecommendationsLoading && (
              <p role="status" aria-live="polite">
                {t("loading")}
              </p>
            )}
            {hasSelectedFilters && (
              <Button
                onClick={clearFilters}
                variant="secondary"
                size="lg"
                className="w-fit"
              >
                {t("clear-filters")}
              </Button>
            )}
          </div>
        )}
        <SearchResults
          results={searchResult}
          allHits={allHits}
          hasNextPage={hasNextPage}
          isLoadingMore={isLoadingMore}
          isInitialLoading={isInitialLoading}
          fetchNextPage={fetchNextPage}
          recommendations={recommendations}
        />
        {isNoMatch && (
          <p>
            {t.rich("request-new-app", {
              forumLink: (chunks) => (
                <a
                  target="_blank"
                  rel="noreferrer"
                  className="no-underline hover:underline"
                  href="https://discourse.flathub.org/t/about-the-requests-category/22"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        )}
      </div>
    </>
  )
}
