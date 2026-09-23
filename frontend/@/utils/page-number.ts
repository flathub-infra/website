export function parsePositivePageNumber(page: string): number | null {
  if (!/^\d+$/.test(page)) {
    return null
  }

  const pageNumber = Number(page)
  return Number.isSafeInteger(pageNumber) && pageNumber > 0 ? pageNumber : null
}
