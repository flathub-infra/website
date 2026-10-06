import { parseAsNativeArrayOf, parseAsString, type inferParserType } from "nuqs"

export const SEARCH_FILTER_PARSERS = {
  main_categories: parseAsNativeArrayOf(parseAsString).withDefault([]),
  is_free_license: parseAsNativeArrayOf(parseAsString).withDefault([]),
  verification_verified: parseAsNativeArrayOf(parseAsString).withDefault([]),
  runtime: parseAsNativeArrayOf(parseAsString).withDefault([]),
  type: parseAsNativeArrayOf(parseAsString).withDefault([]),
  arches: parseAsNativeArrayOf(parseAsString).withDefault([]),
}

export type SearchFilterKey = keyof typeof SEARCH_FILTER_PARSERS
export type SelectedSearchFilter = {
  filterType: SearchFilterKey
  value: string
}
export type SearchFilterQueryState = inferParserType<
  typeof SEARCH_FILTER_PARSERS
>

export const filtersFromQueryState = (
  queryState: SearchFilterQueryState,
): SelectedSearchFilter[] =>
  Object.entries(queryState)
    .flatMap(([filterType, values]) =>
      values.map((value) => ({
        filterType: filterType as SearchFilterKey,
        value,
      })),
    )
    .sort((left, right) =>
      `${left.filterType}\0${left.value}`.localeCompare(
        `${right.filterType}\0${right.value}`,
      ),
    )

export const filtersToQueryState = (
  filters: SelectedSearchFilter[],
): SearchFilterQueryState => {
  const queryState = Object.fromEntries(
    Object.keys(SEARCH_FILTER_PARSERS).map((filterType) => [filterType, []]),
  ) as SearchFilterQueryState

  for (const { filterType, value } of filters) {
    queryState[filterType].push(value)
  }

  for (const filterType of Object.keys(queryState) as SearchFilterKey[]) {
    queryState[filterType] = Array.from(new Set(queryState[filterType])).sort()
  }

  return queryState
}
