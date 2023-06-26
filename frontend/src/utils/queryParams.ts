import { NextRouter } from "next/router"

export function setQueryParams(
  router: NextRouter,
  params: { [param: string]: string },
) {
  let query = router.query

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      const { [key]: _, ...q } = { ...query }
      query = q
    } else {
      query = { ...query, [key]: value }
    }
  }

  router.push({
    pathname: router.pathname,
    query,
  })
}
