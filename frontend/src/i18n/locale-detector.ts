import Negotiator from "negotiator"
import { NextRequest } from "next/server"
import { routing } from "./routing"

const localeSet = new Set<string>(routing.locales)
const LOCALE_COOKIE = "NEXT_LOCALE"

const isSupportedLocale = (locale?: string | null): locale is string =>
  !!locale && localeSet.has(locale)

const getLocaleFromPathname = (pathname: string) => {
  const [maybeLocale] = pathname.split("/").filter(Boolean)
  return isSupportedLocale(maybeLocale) ? maybeLocale : undefined
}

const getLocaleFromCookie = (request: NextRequest) => {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value
  return isSupportedLocale(cookieLocale) ? cookieLocale : undefined
}

const getLocaleFromAcceptLanguage = (request: NextRequest) => {
  const acceptLanguage = request.headers.get("accept-language")
  if (!acceptLanguage) return undefined

  try {
    const headers = Object.fromEntries(request.headers.entries())
    const negotiator = new Negotiator({ headers })
    const locale = negotiator.language(routing.locales)

    return isSupportedLocale(locale) ? locale : undefined
  } catch (error) {
    console.warn("Failed to parse Accept-Language header", error)
    return undefined
  }
}

export const detectLocale = (request: NextRequest) => {
  const { pathname } = request.nextUrl

  const pathnameLocale = getLocaleFromPathname(pathname)
  if (pathnameLocale) {
    return { locale: pathnameLocale, localeInPath: true }
  }

  const cookieLocale = getLocaleFromCookie(request)
  if (cookieLocale) {
    return { locale: cookieLocale, localeInPath: false }
  }

  const headerLocale = getLocaleFromAcceptLanguage(request)
  if (headerLocale) {
    return { locale: headerLocale, localeInPath: false }
  }

  return { locale: routing.defaultLocale, localeInPath: false }
}
