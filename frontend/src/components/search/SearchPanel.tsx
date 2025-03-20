import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Transition,
} from "@headlessui/react"
import { HiOutlineFunnel } from "react-icons/hi2"
import clsx from "clsx"
import { SearchFilters } from "src/components/search/SearchFilters"
import { UseMutationResult } from "@tanstack/react-query"
import { AxiosResponse } from "axios"
import { useTranslation, Trans } from "next-i18next"
import { SearchResults } from "./SearchResults"
import { Button } from "@/components/ui/button"
import { MeilisearchResponseLimitedAppsIndex } from "src/codegen"

export const SearchPanel = ({
  searchResult,
  selectedFilters,
  setSelectedFilters,
  query,
}: {
  searchResult: UseMutationResult<
    AxiosResponse<MeilisearchResponseLimitedAppsIndex, any>,
    unknown
  >
  selectedFilters: {
    filterType: string
    value: string
  }[]
  setSelectedFilters
  query: string
}) => {
  const { t } = useTranslation()

  if (
    searchResult.isSuccess &&
    searchResult.data.data.estimatedTotalHits === 0
  ) {
    return (
      <div>
        <h1 className="pb-8 text-2xl font-bold">
          {t("search-for-query", { query })}
        </h1>
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
                number: searchResult.data?.data?.estimatedTotalHits ?? "000",
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
                <HiOutlineFunnel
                  className={clsx("size-6 transform duration-150")}
                />
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
        <SearchResults results={searchResult} />
      </div>
    </>
  )
}
