import { QueryParams } from "next-intl/navigation"
import { ReadonlyURLSearchParams } from "next/navigation"
import { useRouter } from "src/i18n/navigation"

export function setQueryParams(
  router: ReturnType<typeof useRouter>,
  params: { [param: string]: string | undefined },
  pathname: string,
  searchParams: ReadonlyURLSearchParams,
) {
  const newParams = Object.fromEntries(searchParams.entries()) as QueryParams
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") {
      delete newParams[key]
    } else {
      newParams[key] = value
    }
  }

  router.push({ pathname, query: newParams })
}
