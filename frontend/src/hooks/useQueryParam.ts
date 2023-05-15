import { useRouter } from "next/router"

export function useQueryParam(
  name: string,
): [string, (value?: string) => void] {
  const router = useRouter()

  const value = router.query[name] as string
  const setValue = (value: string) => {
    if (value === undefined) {
      const { [name]: _, ...query } = { ...router.query }
      router.push({
        pathname: router.pathname,
        query,
      })
    } else {
      router.push({
        pathname: router.pathname,
        query: { ...router.query, [name]: value },
      })
    }
  }

  return [value, setValue]
}
