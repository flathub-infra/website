export function loginHref(pathname: string, language?: string) {
  const returnTo = language
    ? `${pathname}?${new URLSearchParams({ language })}`
    : pathname
  return `/login?returnTo=${encodeURIComponent(returnTo)}`
}
