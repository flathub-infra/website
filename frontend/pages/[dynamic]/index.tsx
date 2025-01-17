import { getServerSideSitemapLegacy } from "next-sitemap"
import { GetServerSideProps } from "next"
import { listAppstreamAppstreamGet } from "src/codegen"

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const dynamic = ctx.params?.dynamic

  if (!dynamic) {
    console.log("Dynamic not found")
    return {
      notFound: true,
    }
  }

  if (
    dynamic &&
    typeof dynamic === "string" &&
    !dynamic.startsWith("app-sitemap-")
  ) {
    console.log(`Sitemap dynamic ${dynamic} not found`)
    return {
      notFound: true,
    }
  }

  if (
    Array.isArray(dynamic) &&
    dynamic.every((item) => typeof item === "string")
  ) {
    console.log(`Sitemap dynamic ${dynamic} not found`)
    return {
      notFound: true,
    }
  }

  const appstreamList = await listAppstreamAppstreamGet()

  //figure out which chunk to render
  const chunk: number = parseInt(
    (dynamic as string).split("-")[2].split(".")[0],
  )
  const chunkSize = Number(process.env.NEXT_PUBLIC_SITEMAP_SIZE || 5000)
  const numberOfChunks = Math.ceil(appstreamList.data.length / chunkSize)

  if (chunk >= numberOfChunks) {
    console.log(`Sitemap chunk ${chunk} not found`)
    return {
      notFound: true,
    }
  }

  return getServerSideSitemapLegacy(
    ctx,
    appstreamList.data
      .slice(
        chunk * chunkSize,
        Math.min(chunk + 1 * chunkSize, appstreamList.data.length),
      )
      .map((appId, i) => ({
        loc: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps/${appId}`,
        // todo - add more fields here, maybe get lastmod from summary
        lastmod: new Date().toISOString(),
        alternateRefs: ctx.locales?.map((lang) => ({
          href: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/${lang}/apps/${appId}`,
          hreflang: lang,
        })),
      })),
  )
}

export default function Sitemap() {}
