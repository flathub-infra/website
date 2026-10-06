import {
  generateImageUrl,
  type IGenerateImageUrl,
} from "@imgproxy/imgproxy-node"

type Resize = NonNullable<NonNullable<IGenerateImageUrl["options"]>["resize"]>
type ResizingType = NonNullable<Resize["resizing_type"]>

const imgproxyEndpoint = "https://imgproxy.flathub.org/"

export function getOgImageUrl(
  src: string,
  width: number,
  height: number,
  resizingType: ResizingType = "fit",
) {
  return generateImageUrl({
    endpoint: imgproxyEndpoint,
    url: src,
    options: {
      resize: {
        width,
        height,
        resizing_type: resizingType,
      },
      format: "png",
    },
  })
}

export async function getOgImageDataUrl(
  src: string,
  width: number,
  height: number,
  resizingType: ResizingType = "fit",
): Promise<string | undefined> {
  try {
    const response = await fetch(
      getOgImageUrl(src, width, height, resizingType),
    )
    if (!response.ok) return undefined

    const contentType = response.headers.get("content-type") ?? "image/png"
    const data = Buffer.from(await response.arrayBuffer()).toString("base64")
    return `data:${contentType};base64,${data}`
  } catch {
    return undefined
  }
}
