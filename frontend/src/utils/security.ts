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
