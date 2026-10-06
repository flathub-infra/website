export const getSearchFacetValues = (
  displayedFacetValues: Record<string, number>,
  selectedValues: string[],
): string[] => {
  const values = new Set(Object.keys(displayedFacetValues))
  selectedValues.forEach((value) => values.add(value))
  return Array.from(values)
}
