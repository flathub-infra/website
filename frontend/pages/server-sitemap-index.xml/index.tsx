// pages/server-sitemap-index.xml/index.tsx
import { getServerSideSitemapIndexLegacy } from "next-sitemap"
import { GetServerSideProps } from "next"
import { fetchAppstreamList } from "src/fetchers"

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const appstreamList = await fetchAppstreamList()

  // make chunks
  const chunkSize = Number(process.env.NEXT_PUBLIC_SITEMAP_SIZE || 5000)
  const numberOfChunks = Math.ceil(appstreamList.length / chunkSize)

  return getServerSideSitemapIndexLegacy(
    ctx,
    [...Array(numberOfChunks)].map(
      (_bucket, i) =>
        `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/app-sitemap-${i}.xml`,
    ),
  )
}

// Default export to prevent next.js errors
export default function SitemapIndex() {}
