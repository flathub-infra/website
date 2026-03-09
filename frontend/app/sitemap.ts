import type { MetadataRoute } from "next"
import { languages } from "src/localize"

const siteBaseUrl =
  process.env.NEXT_PUBLIC_SITE_BASE_URI || "https://flathub.org"
const sitemapLocales = languages.filter((locale) => locale !== "en-GB")
const indexedRoutes = [
  "",
  "/about",
  "/badges",
  "/consultants",
  "/feeds",
  "/languages",
  "/privacy-policy",
  "/setup",
  "/statistics",
  "/terms-and-conditions",
  "/apps/collection/mobile/1",
  "/apps/collection/popular/1",
  "/apps/collection/recently-added/1",
  "/apps/collection/recently-updated/1",
  "/apps/collection/trending/1",
  "/apps/collection/verified/1",
] as const

function toAbsoluteUrl(pathname: string) {
  return new URL(pathname, `${siteBaseUrl}/`).toString()
}

function getLocalizedPath(locale: string, route: string) {
  return route.length === 0 ? `/${locale}/` : `/${locale}${route}`
}

function getAlternateLanguages(route: string) {
  return Object.fromEntries(
    sitemapLocales.map((locale) => [
      locale,
      toAbsoluteUrl(getLocalizedPath(locale, route)),
    ]),
  )
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return indexedRoutes.flatMap((route) =>
    sitemapLocales.map((locale) => ({
      url: toAbsoluteUrl(getLocalizedPath(locale, route)),
      lastModified,
      alternates: {
        languages: getAlternateLanguages(route),
      },
    })),
  )
}
