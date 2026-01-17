import { GetAppstreamAppstreamAppIdGet200, Screenshot } from "src/codegen"

export type AppstreamListItem = Pick<
  GetAppstreamAppstreamAppIdGet200,
  "id" | "summary" | "icon" | "name" | "metadata"
> &
  Partial<Pick<GetAppstreamAppstreamAppIdGet200, "bundle">>

/**
 * Always returns the biggest screenshot available, as the image proxy will resize it as needed.
 *
 * @param screenshot - The screenshot object containing sizes and caption.
 * @returns The biggest screenshot
 */
export function findBiggestScreenshotSize(screenshot?: Screenshot):
  | {
      src: string
      width: number
      height: number
      caption: string
      scale: number
    }
  | undefined {
  if (!screenshot) {
    return undefined
  }

  const orderedByResolution = screenshot.sizes
    .map((key) => {
      const width = key.width
      const widthNumber = parseInt(width)

      const height = key.height
      const heightNumber = parseInt(height)

      return { key, width: widthNumber, height: heightNumber }
    })
    .sort((a, b) => {
      if (a.width > b.width) {
        return -1
      } else if (a.width < b.width) {
        return 1
      } else {
        if (a.height > b.height) {
          return -1
        } else if (a.height < b.height) {
          return 1
        } else {
          return 0
        }
      }
    })

  const highestResolution = orderedByResolution[0]

  if (!highestResolution) {
    return undefined
  }

  const scale = parseInt(highestResolution.key.scale.split("x")[0])

  return {
    src: highestResolution.key.src,
    width: highestResolution.width,
    height: highestResolution.height,
    caption: screenshot.caption,
    scale: scale,
  }
}

export function mapScreenshot(screenshot: Screenshot) {
  const screenshotVariant = screenshot.sizes.map((key) => {
    const width = key.width
    const widthNumber = parseInt(width)

    const height = key.height
    const heightNumber = parseInt(height)

    const scale = parseInt(key.scale.split("x")[0])

    return {
      src: key.src,
      width: widthNumber,
      height: heightNumber,
      caption: screenshot.caption,
      scale: scale,
    }
  })

  if (screenshotVariant.length === 0) {
    return undefined
  }

  return {
    ...findBiggestScreenshotSize(screenshot),
    srcSet: screenshotVariant,
  }
}

export function findBiggestIcon(
  icons: GetAppstreamAppstreamAppIdGet200["icons"],
): string | undefined {
  if (!icons || icons.length === 0) {
    return undefined
  }

  const orderedBySize = icons.sort((a, b) => {
    if (a.height !== b.height) {
      return a.height - b.height
    }
    return a.scale - b.scale
  })

  return orderedBySize[orderedBySize.length - 1].url
}
