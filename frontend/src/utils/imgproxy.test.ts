import { describe, expect, it } from "vitest"
import { generateImageUrl } from "@imgproxy/imgproxy-node"
import type { Options } from "@imgproxy/imgproxy-js-core"
import { generateUnsignedImageUrl } from "./imgproxy"

describe("generateUnsignedImageUrl", () => {
  const sources = [
    "https://dl.flathub.org/media/org.example.App/screenshot.png",
    "https://example.com/screenshot.png?width=100&name=a+b#image",
    "https://example.com/截图/écran 🎨.png",
    "/_next/static/media/screenshot.123.png",
  ]
  const options: (Options | undefined)[] = [
    undefined,
    {
      resize: { width: 640, height: 360, resizing_type: "fit" },
      format: "webp",
      dpr: 1,
    },
    {
      resize: { width: 320, height: 180, resizing_type: "fill-down" },
      format: "avif",
      dpr: 2,
    },
    {
      resize: { width: undefined, height: undefined, resizing_type: "fit" },
      format: "webp",
      quality: 80,
    },
  ]

  for (const source of sources) {
    it.each(options)(
      `matches the Node builder for ${source} with %j`,
      (options) => {
        expect(generateUnsignedImageUrl(source, options)).toBe(
          generateImageUrl({
            endpoint: "https://imgproxy.flathub.org/",
            url: source,
            options,
            key: "",
            salt: "",
          }),
        )
      },
    )
  }
})
