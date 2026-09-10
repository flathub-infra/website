import { Checkbox } from "@/components/ui/checkbox"
import { CheckedState } from "@radix-ui/react-checkbox"
import { UseMutationResult } from "@tanstack/react-query"
import { AxiosResponse } from "axios"
import { useTranslations } from "next-intl"
import { MeilisearchResponseAppsIndex } from "src/codegen"
import { categoryToName, stringToCategory } from "src/types/Category"

type SelectedFilter = {
  filterType: string
  value: string
}

type SearchFilterProps = {
  results: UseMutationResult<
    AxiosResponse<MeilisearchResponseAppsIndex, any>,
    unknown
  >
  selectedFilters: SelectedFilter[]
  setSelectedFilters: (filters: SelectedFilter[]) => void
}

const FilterFacette = ({
  label,
  count,
  checked,
  onCheckedChange,
}: {
  label: string
  count: number
  checked: boolean
  onCheckedChange: (e: CheckedState) => void
}) => {
  return (
    <label className="items-top flex gap-x-2 pt-1.5">
      <Checkbox checked={checked} onCheckedChange={onCheckedChange} />
      <span className="grid gap-1.5 leading-none">{`${label} (${count})`}</span>
    </label>
  )
}

const SearchFilterSection = ({
  title,
  filterType,
  loadingCount,
  results,
  selectedFilters,
  setSelectedFilters,
}: SearchFilterProps & {
  title: string
  filterType: string
  loadingCount: number
}) => {
  const t = useTranslations()
  const facetValues = results.data?.data.facetDistribution?.[filterType] ?? {}
  const values = [
    ...Object.keys(facetValues),
    ...selectedFilters
      .filter((filter) => filter.filterType === filterType)
      .map((filter) => filter.value)
      .filter((value) => !(value in facetValues)),
  ]
  if (
    filterType === "is_free_license" ||
    filterType === "verification_verified"
  ) {
    values.sort(
      (left, right) => Number(right === "true") - Number(left === "true"),
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-bold">{title}</h2>
      {results.isPending &&
        [...new Array(loadingCount)].map((_, index) => (
          <div key={index} className="blur-xs flex flex-col gap-2">
            <FilterFacette
              label="Loading..."
              count={0}
              checked={false}
              onCheckedChange={() => {}}
            />
          </div>
        ))}
      {results.isSuccess &&
        values.map((value) => {
          const checked = selectedFilters.some(
            (filter) =>
              filter.filterType === filterType && filter.value === value,
          )
          const label =
            filterType === "main_categories"
              ? categoryToName(stringToCategory(value), t)
              : filterType === "is_free_license"
                ? value === "true"
                  ? t("flos")
                  : t("proprietary")
                : filterType === "verification_verified"
                  ? value === "true"
                    ? t("verified")
                    : t("unverified")
                  : filterType === "type"
                    ? t(value)
                    : value
          return (
            <FilterFacette
              key={value}
              label={label}
              count={facetValues[value] ?? 0}
              checked={checked}
              onCheckedChange={(isChecked) => {
                if (isChecked) {
                  setSelectedFilters([
                    ...selectedFilters,
                    { filterType, value },
                  ])
                  return
                }
                setSelectedFilters(
                  selectedFilters.filter(
                    (filter) =>
                      filter.filterType !== filterType ||
                      filter.value !== value,
                  ),
                )
              }}
            />
          )
        })}
    </div>
  )
}

export const SearchFilters = ({
  results,
  selectedFilters,
  setSelectedFilters,
}: SearchFilterProps) => {
  const t = useTranslations()

  return (
    <div className="flex min-w-[300px] flex-col gap-4">
      <SearchFilterSection
        title={t("categories")}
        filterType="main_categories"
        loadingCount={10}
        results={results}
        selectedFilters={selectedFilters}
        setSelectedFilters={setSelectedFilters}
      />
      <SearchFilterSection
        title={t("license")}
        filterType="is_free_license"
        loadingCount={2}
        results={results}
        selectedFilters={selectedFilters}
        setSelectedFilters={setSelectedFilters}
      />
      <SearchFilterSection
        title={t("verification")}
        filterType="verification_verified"
        loadingCount={2}
        results={results}
        selectedFilters={selectedFilters}
        setSelectedFilters={setSelectedFilters}
      />
      {selectedFilters.some((filter) => filter.filterType === "runtime") && (
        <SearchFilterSection
          title={t("runtime")}
          filterType="runtime"
          loadingCount={1}
          results={results}
          selectedFilters={selectedFilters}
          setSelectedFilters={setSelectedFilters}
        />
      )}
      <SearchFilterSection
        title={t("app-type")}
        filterType="type"
        loadingCount={1}
        results={results}
        selectedFilters={selectedFilters}
        setSelectedFilters={setSelectedFilters}
      />
      <SearchFilterSection
        title={t("arch")}
        filterType="arches"
        loadingCount={2}
        results={results}
        selectedFilters={selectedFilters}
        setSelectedFilters={setSelectedFilters}
      />
    </div>
  )
}
