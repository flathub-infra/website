import { render, renderSvg, type RenderInput } from "takumi-js"
import { fonts } from "./fontManager"

export async function renderOgImage(
  content: RenderInput,
  {
    width,
    height,
    locale,
    asSvg,
    cacheControl = "public, max-age=31536000, immutable",
  }: {
    width: number
    height: number
    locale: string
    asSvg: boolean
    cacheControl?: string
  },
) {
  const options = { width, height, fonts, lang: locale }
  const image = asSvg
    ? await renderSvg(content, options)
    : await render(content, options)

  return new Response(image, {
    status: 200,
    headers: {
      "Content-Type": asSvg ? "image/svg+xml" : "image/png",
      "Cache-Control": cacheControl,
    },
  })
}
