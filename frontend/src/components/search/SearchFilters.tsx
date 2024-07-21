import { UseQueryResult } from "@tanstack/react-query"
import { AxiosResponse } from "axios"
import { useTranslation } from "next-i18next"
import { AppsIndex, MeilisearchResponseLimited } from "src/meilisearch"
import { categoryToName, stringToCategory } from "src/types/Category"

const FilterFacette = ({
  label,
  count,
  checked,
  onChange,
}: {
  label: string
  count: number
  checked: boolean
  onChange: (e) => void
}) => {
  return (
    <label className="flex items-center">
      <input
        type="checkbox"
        className="form-checkbox"
        checked={checked}
        onChange={onChange}
      />
      <span className="ms-2">{`${label} (${count})`}</span>
    </label>
  )
}

const SearchFilterCategories = ({
  results,
  selectedFilters,
  setSelectedFilters,
}: {
  results: UseQueryResult<
    AxiosResponse<MeilisearchResponseLimited<AppsIndex>, any>,
    unknown
  >
  selectedFilters: {
    filterType: string
    value: string
  }[]
  setSelectedFilters
}) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-bold">{t("categories")}</h2>
      {results.isPending &&
        [...new Array(10)].map((a, i) => {
          return (
            <>
              <div key={i} className={"blur-sm flex flex-col gap-2"}>
                <FilterFacette
                  label={"Loading..."}
                  count={0}
                  checked={false}
                  onChange={() => {}}
                />
              </div>
            </>
          )
        })}

      {results.isSuccess &&
        Object.keys(results?.data?.data.facetDistribution.main_categories).map(
          (category) => (
            <FilterFacette
              key={category}
              label={categoryToName(stringToCategory(category), t)}
              count={
                results?.data.data.facetDistribution?.main_categories[category]
              }
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
          ),
        )}
    </div>
  )
}

const SearchFilterFloss = ({
  results,
  selectedFilters,
  setSelectedFilters,
}: {
  results: UseQueryResult<
    AxiosResponse<MeilisearchResponseLimited<AppsIndex>, any>,
    unknown
  >
  selectedFilters: {
    filterType: string
    value: string
  }[]
  setSelectedFilters
}) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-bold">{t("license")}</h2>
      {results.isPending &&
        [...new Array(2)].map((a, i) => {
          return (
            <>
              <div key={i} className={"blur-sm flex flex-col gap-2"}>
                <FilterFacette
                  label={"Loading..."}
                  count={0}
                  checked={false}
                  onChange={() => {}}
                />
              </div>
            </>
          )
        })}

      {results.isSuccess &&
        Object.keys(results?.data.data.facetDistribution?.is_free_license)
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
            <FilterFacette
              key={`${license}-${i}`}
              label={license === "true" ? t("flos") : t("proprietary")}
              count={
                results?.data.data.facetDistribution?.is_free_license[license]
              }
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
          ))}
    </div>
  )
}

const SearchFilterVerified = ({
  results,
  selectedFilters,
  setSelectedFilters,
}: {
  results: UseQueryResult<
    AxiosResponse<MeilisearchResponseLimited<AppsIndex>, any>,
    unknown
  >
  selectedFilters: {
    filterType: string
    value: string
  }[]
  setSelectedFilters
}) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-bold">{t("verification")}</h2>
      {results.isPending &&
        [...new Array(2)].map((a, i) => {
          return (
            <>
              <div key={i} className={"blur-sm flex flex-col gap-2"}>
                <FilterFacette
                  label={"Loading..."}
                  count={0}
                  checked={false}
                  onChange={() => {}}
                />
              </div>
            </>
          )
        })}

      {results.isSuccess &&
        Object.keys(results?.data.data.facetDistribution?.verification_verified)
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
            <FilterFacette
              key={`${verified}-${i}`}
              label={verified === "true" ? t("verified") : t("not-verified")}
              count={
                results?.data.data.facetDistribution?.verification_verified[
                  verified
                ]
              }
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
          ))}
    </div>
  )
}

const SearchFilterTypes = ({
  results,
  selectedFilters,
  setSelectedFilters,
}: {
  results: UseQueryResult<
    AxiosResponse<MeilisearchResponseLimited<AppsIndex>, any>,
    unknown
  >
  selectedFilters: {
    filterType: string
    value: string
  }[]
  setSelectedFilters
}) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-bold">{t("app-type")}</h2>
      {results.isPending &&
        [...new Array(1)].map((a, i) => {
          return (
            <>
              <div key={i} className={"blur-sm flex flex-col gap-2"}>
                <FilterFacette
                  label={"Loading..."}
                  count={0}
                  checked={false}
                  onChange={() => {}}
                />
              </div>
            </>
          )
        })}

      {results.isSuccess &&
        Object.keys(results?.data.data.facetDistribution?.type).map((type) => (
          <FilterFacette
            key={type}
            label={t(type)}
            count={results?.data.data.facetDistribution?.type[type]}
            checked={selectedFilters.some(
              (filter) => filter.filterType === "type" && filter.value === type,
            )}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedFilters([
                  ...selectedFilters,
                  {
                    filterType: "type",
                    value: type,
                  },
                ])
              } else {
                setSelectedFilters(
                  selectedFilters.filter(
                    (filter) =>
                      !(filter.filterType === "type" && filter.value === type),
                  ),
                )
              }
            }}
          />
        ))}
    </div>
  )
}

const SearchFilterArches = ({
  results,
  selectedFilters,
  setSelectedFilters,
}: {
  results: UseQueryResult<
    AxiosResponse<MeilisearchResponseLimited<AppsIndex>, any>,
    unknown
  >
  selectedFilters: {
    filterType: string
    value: string
  }[]
  setSelectedFilters
}) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-bold">{t("arch")}</h2>
      {results.isPending &&
        [...new Array(2)].map((a, i) => {
          return (
            <>
              <div key={i} className={"blur-sm flex flex-col gap-2"}>
                <FilterFacette
                  label={"Loading..."}
                  count={0}
                  checked={false}
                  onChange={() => {}}
                />
              </div>
            </>
          )
        })}

      {results.isSuccess &&
        Object.keys(results?.data.data.facetDistribution?.arches).map(
          (arch) => (
            <FilterFacette
              key={arch}
              label={t(arch)}
              count={results?.data.data.facetDistribution?.arches[arch]}
              checked={selectedFilters.some(
                (filter) =>
                  filter.filterType === "arches" && filter.value === arch,
              )}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedFilters([
                    ...selectedFilters,
                    {
                      filterType: "arches",
                      value: arch,
                    },
                  ])
                } else {
                  setSelectedFilters(
                    selectedFilters.filter(
                      (filter) =>
                        !(
                          filter.filterType === "arches" &&
                          filter.value === arch
                        ),
                    ),
                  )
                }
              }}
            />
          ),
        )}
    </div>
  )
}
export const SearchFilters = ({
  results,
  selectedFilters,
  setSelectedFilters,
}: {
  results: UseQueryResult<
    AxiosResponse<MeilisearchResponseLimited<AppsIndex>, any>,
    unknown
  >
  selectedFilters: {
    filterType: string
    value: string
  }[]
  setSelectedFilters
}) => {
  return (
    <div className="flex min-w-[300px] flex-col gap-4">
      <SearchFilterCategories
        results={results}
        selectedFilters={selectedFilters}
        setSelectedFilters={setSelectedFilters}
      />
      <SearchFilterFloss
        results={results}
        selectedFilters={selectedFilters}
        setSelectedFilters={setSelectedFilters}
      />
      <SearchFilterVerified
        results={results}
        selectedFilters={selectedFilters}
        setSelectedFilters={setSelectedFilters}
      />
      <SearchFilterTypes
        results={results}
        selectedFilters={selectedFilters}
        setSelectedFilters={setSelectedFilters}
      />
      <SearchFilterArches
        results={results}
        selectedFilters={selectedFilters}
        setSelectedFilters={setSelectedFilters}
      />
    </div>
  )
}
