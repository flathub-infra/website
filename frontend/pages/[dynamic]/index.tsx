import { getServerSideSitemapLegacy } from "next-sitemap"
import { GetServerSideProps } from "next"
import { fetchAppstreamList } from "src/fetchers"

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const dynamic = ctx.params.dynamic as string

  if (!dynamic.startsWith("app-sitemap-")) {
    return {
      notFound: true,
    }
  }

  const appstreamList = await fetchAppstreamList()

  //figure out which chunk to render
  const chunk: number = parseInt(dynamic.split("-")[2].split(".")[0])
  const chunkSize = Number(process.env.NEXT_PUBLIC_SITEMAP_SIZE || 5000)
  const numberOfChunks = Math.ceil(appstreamList.length / chunkSize)

  if (chunk >= numberOfChunks) {
    return {
      notFound: true,
    }
  }

  return getServerSideSitemapLegacy(
    ctx,
    appstreamList
      .slice(
        chunk * chunkSize,
        Math.min(chunk + 1 * chunkSize, appstreamList.length),
      )
      .map((appId, i) => ({
        loc: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps/${appId}`,
        // todo - add more fields here, maybe get lastmod from summary
        lastmod: new Date().toISOString(),
        alternateRefs: ctx.locales.map((lang) => ({
          href: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/${lang}/apps/${appId}`,
          hreflang: lang,
        })),
      })),
  )
}

export default function Sitemap() {}
