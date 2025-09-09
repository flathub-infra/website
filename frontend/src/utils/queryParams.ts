import { useRouter, usePathname } from "src/i18n/navigation"

export function setQueryParams(
  router: ReturnType<typeof useRouter>,
  params: { [param: string]: string | undefined },
  pathname: string,
  searchParams: URLSearchParams,
) {
  const newParams = new URLSearchParams(searchParams.toString())

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") {
      newParams.delete(key)
    } else {
      newParams.set(key, value)
    }
  }

  const queryString = newParams.toString()
  const url = queryString ? `${pathname}?${queryString}` : pathname

  router.push(url)
}
