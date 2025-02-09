import { getServerSideSitemap } from "next-sitemap"
import { notFound } from "next/navigation"
import { languages } from "src/localize"

export async function createAppSitemap(chunk: number) {
  const appstreamList = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URI}/appstream`,
  ).then((res) => res.json())

  //figure out which chunk to render
  const chunkSize = Number(process.env.NEXT_PUBLIC_SITEMAP_SIZE || 5000)
  const numberOfChunks = Math.ceil(appstreamList.length / chunkSize)

  if (chunk >= numberOfChunks) {
    console.log(`Sitemap chunk ${chunk} not found`)
    return notFound()
  }

  return getServerSideSitemap(
    appstreamList
      .slice(
        chunk * chunkSize,
        Math.min(chunk + 1 * chunkSize, appstreamList.length),
      )
      .map((appId, i) => ({
        loc: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps/${appId}`,
        // todo - add more fields here, maybe get lastmod from summary
        lastmod: new Date().toISOString(),
        alternateRefs: languages?.map((lang) => ({
          href: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/${lang}/apps/${appId}`,
          hreflang: lang,
        })),
      })),
  )
}
