import {
  buildAppEntries,
  buildSitemapXml,
  buildStaticEntries,
  fetchAppIds,
  getAppSlice,
  getChunkCount,
  xmlHeaders,
} from "app/sitemap-utils"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idParam } = await params
  const id = Number(idParam.replace(/\.xml$/, ""))

  if (Number.isNaN(id) || id < 0) {
    return new Response("Not Found", { status: 404 })
  }

  // Chunk 0 = static pages
  if (id === 0) {
    return new Response(buildSitemapXml(buildStaticEntries()), {
      headers: xmlHeaders,
    })
  }

  // Chunks 1..N = app pages
  const appIds = await fetchAppIds()
  const appChunkCount = getChunkCount(appIds.length)
  const chunkIndex = id - 1

  if (chunkIndex >= appChunkCount) {
    return new Response("Not Found", { status: 404 })
  }

  const slice = getAppSlice(appIds, chunkIndex)

  return new Response(buildSitemapXml(buildAppEntries(slice)), {
    headers: xmlHeaders,
  })
}
