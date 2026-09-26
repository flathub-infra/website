/**
 * Checks whether a given string is a URL pointing to the current host.
 * Should be used before redirecting if untrusted input is involved.
 * @param url URL string
 * @returns if the URL points to the current host
 */
export function isInternalRedirect(url: string): boolean {
  try {
    const parsedRedirect = new URL(url, process.env.NEXT_PUBLIC_SITE_BASE_URI)

    return parsedRedirect.host === location.host
  } catch {
    return false
  }
}

/**
 * Whether a (same-origin) redirect targets a backend endpoint rather than a
 * Next.js route — currently the OIDC authorize resume URL (its path contains
 * `/oidc/`, possibly under an API prefix such as `/api/v2`). Such targets require
 * a full-page navigation, not the next-intl client router.
 * @param url URL string (path or absolute, same-origin)
 * @returns if the URL points to a backend endpoint
 */
export function isBackendRedirect(url: string): boolean {
  try {
    return new URL(
      url,
      process.env.NEXT_PUBLIC_SITE_BASE_URI,
    ).pathname.includes("/oidc/")
  } catch {
    return false
  }
}

/**
 * Whether a pathname is the email sign-in confirm page, which receives the
 * magic-link token and must be kept out of analytics and error reporting.
 * Accepts pathnames with or without a locale prefix.
 * @param pathname URL pathname
 * @returns if the pathname is the email confirm page
 */
export function isEmailConfirmRoute(pathname: string): boolean {
  return /^(?:\/[a-z]{2,3}(?:-[A-Za-z]{2,4})?)?\/login\/email\/confirm\/?$/.test(
    pathname,
  )
}
