import { getServerSideSitemapIndex } from "next-sitemap"

export async function GET(request: Request) {
  const appstreamList = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URI}/appstream`,
  ).then((res) => res.json())

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
