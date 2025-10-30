import { GetAppstreamAppstreamAppIdGet200, Screenshot } from "src/codegen"

export type AppstreamListItem = Pick<
  GetAppstreamAppstreamAppIdGet200,
  "id" | "summary" | "icon" | "name" | "metadata"
> &
  Partial<Pick<GetAppstreamAppstreamAppIdGet200, "bundle">>

export function pickScreenshotSize(
  screenshot?: Screenshot,
  maxHeight?: number,
):
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

  const highestResolution = orderedByResolution.find(
    (screenshot) => maxHeight === undefined || screenshot.height <= maxHeight,
  )

  const scale = parseInt(highestResolution?.key.scale.split("x")[0])

  return highestResolution
    ? {
        src: highestResolution.key.src,
        width: highestResolution.width,
        height: highestResolution.height,
        caption: screenshot.caption,
        scale: scale,
      }
    : undefined
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
    ...pickScreenshotSize(screenshot),
    srcSet: screenshotVariant,
  }
}
