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
