"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { routing } from "src/i18n/routing"

const localeSet = new Set<string>(routing.locales)
const LOCALE_COOKIE = "NEXT_LOCALE"

const isLocalizedPathname = (pathname: string) => {
  const [maybeLocale] = pathname.split("/").filter(Boolean)
  return maybeLocale !== undefined && localeSet.has(maybeLocale)
}

const readCookieLocale = () => {
  const match = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${LOCALE_COOKIE}=`))

  if (!match) return undefined

  const value = decodeURIComponent(match.split("=").at(1) ?? "")
  return localeSet.has(value) ? value : undefined
}

const readMetaLocale = () => {
  const content = document
    .querySelector('meta[name="x-detected-locale"]')
    ?.getAttribute("content")

  return content && localeSet.has(content) ? content : undefined
}

const getDetectedLocale = () => readCookieLocale() ?? readMetaLocale()

const buildLocalizedPathname = (pathname: string, locale: string) => {
  if (pathname === "/") {
    return `/${locale}/`
  }

  return `/${locale}${pathname}`
}

const buildUrl = (pathname: string, locale: string) => {
  const search = window.location.search ?? ""
  const hash = window.location.hash ?? ""

  return `${buildLocalizedPathname(pathname, locale)}${search}${hash}`
}

const LocaleRedirector = () => {
  const router = useRouter()
  const pathname = usePathname()
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    if (!pathname || isLocalizedPathname(pathname)) return

    const locale = getDetectedLocale() ?? routing.defaultLocale

    router.replace(buildUrl(pathname, locale), { scroll: false })
  }, [pathname, router])

  return null
}

export default LocaleRedirector
