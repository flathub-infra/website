import { getServerSideSitemapIndex } from "next-sitemap"
import { robustFetchJson } from "src/utils/fetch"

export async function GET(request: Request) {
  const appstreamList = await robustFetchJson<string[]>(
    `${process.env.NEXT_PUBLIC_API_BASE_URI}/appstream`,
  )

  // make chunks
  const chunkSize = Number(process.env.NEXT_PUBLIC_SITEMAP_SIZE || 5000)
  const numberOfChunks = Math.ceil(appstreamList.length / chunkSize)

  return getServerSideSitemapIndex(
    [...Array(numberOfChunks)].map(
      (_bucket, i) =>
        `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/app-sitemap-${i}.xml`,
    ),
  )
}
