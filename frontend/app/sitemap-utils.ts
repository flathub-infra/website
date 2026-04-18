import { languages } from "src/localize"
import { getApiBaseUrl } from "src/utils/api-url"

const siteUrl = process.env.NEXT_PUBLIC_SITE_BASE_URI || "https://flathub.org"

const CHUNK_SIZE = Number(process.env.NEXT_PUBLIC_SITEMAP_SIZE || 5000)

// Languages to include in alternateRefs (exclude en-GB which is noindex)
const sitemapLanguages = languages.filter((lang) => lang !== "en-GB")

export const staticPages = [
  "",
  "/about",
  "/statistics",
  "/setup",
  "/languages",
  "/consultants",
  "/badges",
  "/feeds",
  "/apps/search",
  "/terms-and-conditions",
  "/privacy-policy",
]

export async function fetchAppIds(): Promise<string[]> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/appstream`)

    if (!response.ok) {
      console.error(`Failed to fetch appstream list: ${response.statusText}`)
      return []
    }

    return response.json()
  } catch (error) {
    console.error("Failed to fetch appstream list:", error)
    return []
  }
}

export function getChunkCount(totalApps: number): number {
  return Math.ceil(totalApps / CHUNK_SIZE)
}

export function getAppSlice(appIds: string[], chunkIndex: number): string[] {
  const start = chunkIndex * CHUNK_SIZE
  const end = Math.min((chunkIndex + 1) * CHUNK_SIZE, appIds.length)
  return appIds.slice(start, end)
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function buildUrlEntry(path: string): string {
  const url = `${siteUrl}/en${path}`
  const alternates = sitemapLanguages
    .map(
      (lang) =>
        `    <xhtml:link rel="alternate" hreflang="${escapeXml(lang)}" href="${escapeXml(`${siteUrl}/${lang}${path}`)}" />`,
    )
    .join("\n")

  return `  <url>
    <loc>${escapeXml(url)}</loc>
    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(url)}" />
${alternates}
  </url>`
}

export function buildSitemapXml(entries: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join("\n")}
</urlset>`
}

export function buildSitemapIndexXml(sitemapUrls: string[]): string {
  const entries = sitemapUrls
    .map(
      (url) => `  <sitemap>
    <loc>${escapeXml(url)}</loc>
  </sitemap>`,
    )
    .join("\n")

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>`
}

export function buildStaticEntries(): string[] {
  return staticPages.map((page) => buildUrlEntry(page))
}

export function buildAppEntries(appIds: string[]): string[] {
  return appIds.map((appId) => buildUrlEntry(`/apps/${appId}`))
}

export const xmlHeaders = {
  "Content-Type": "application/xml",
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
} as const
