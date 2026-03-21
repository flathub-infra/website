import {
  buildSitemapIndexXml,
  fetchAppIds,
  getChunkCount,
  xmlHeaders,
} from "app/sitemap-utils"

export const dynamic = "force-dynamic"

const siteUrl = process.env.NEXT_PUBLIC_SITE_BASE_URI || "https://flathub.org"

export async function GET() {
  const appIds = await fetchAppIds()
  const appChunkCount = getChunkCount(appIds.length)

  // Chunk 0 = static pages, chunks 1..N = app pages
  const sitemapUrls = Array.from(
    { length: appChunkCount + 1 },
    (_, i) => `${siteUrl}/sitemap/${i}.xml`,
  )

  return new Response(buildSitemapIndexXml(sitemapUrls), {
    headers: xmlHeaders,
  })
}
