export type AppstreamListItem = Pick<
  Appstream,
  "id" | "summary" | "icon" | "name" | "metadata"
>

export type Appstream = DesktopAppstream | AddonAppstream

export interface DesktopAppstream {
  type: "desktop-application"
  description: string
  screenshots?: Screenshot[]
  releases: Release[]
  content_rating: ContentRating
  urls?: Urls
  icon: string
  id: string
  name: string
  summary: string
  developer_name: string
  categories: string[]
  kudos: string[]
  mimetypes: string[]
  project_license?: string
  project_group?: string
  provides: string[]
  launchable: Launchable
  bundle: Bundle
  metadata?: Metadata
  keywords: string[]
}

export interface AddonAppstream {
  type: "addon"
  content_rating: ContentRating
  urls: Urls
  icon?: any
  id: string
  name: string
  summary: string
  project_license?: string
  extends: string
  bundle: Bundle
  metadata?: Metadata
}

interface ContentRating {
  type: string
  "violence-cartoon": ContentRatingLevel
  "violence-fantasy": ContentRatingLevel
  "violence-realistic": ContentRatingLevel
  "violence-bloodshed": ContentRatingLevel
  "violence-sexual": ContentRatingLevel
  "violence-desecration": ContentRatingLevel
  "violence-slavery": ContentRatingLevel
  "violence-worship": ContentRatingLevel
  "drugs-alcohol": ContentRatingLevel
  "drugs-narcotics": ContentRatingLevel
  "drugs-tobacco": ContentRatingLevel
  "sex-nudity": ContentRatingLevel
  "sex-themes": ContentRatingLevel
  "sex-homosexuality": ContentRatingLevel
  "sex-prostitution": ContentRatingLevel
  "sex-adultery": ContentRatingLevel
  "sex-appearance": ContentRatingLevel
  "language-profanity": ContentRatingLevel
  "language-humor": ContentRatingLevel
  "language-discrimination": ContentRatingLevel
  "social-chat": ContentRatingLevel
  "social-info": ContentRatingLevel
  "social-audio": ContentRatingLevel
  "social-location": ContentRatingLevel
  "social-contacts": ContentRatingLevel
  "money-purchasing": ContentRatingLevel
  "money-gambling": ContentRatingLevel
}

type ContentRatingLevel = "none" | "mild" | "moderate" | "intense"

export interface Urls {
  bugtracker: string
  donation: string
  homepage: string
  translate: string
  help: string
  faq: string
  contact: string
  vcs_browser: string
  contribute: string
}

export interface Screenshot {
  caption: string
  sizes: ScreenshotSize[]
}

export interface ScreenshotSize {
  [key: string]: string
}

export function pickScreenshot(
  screenshot: Screenshot,
  maxHeight?: number,
): { src: string; width: number; height: number; caption: string } | undefined {
  const orderedByResolution = Object.keys(screenshot.sizes)
    .map((key) => {
      const width = key.split("x")[0]
      const widthNumber = parseInt(width)

      const height = key.split("x")[1]
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

  return highestResolution
    ? {
        src: screenshot.sizes[highestResolution.key],
        width: highestResolution.width,
        height: highestResolution.height,
        caption: screenshot.caption,
      }
    : undefined
}

export function mapScreenshot(screenshot: Screenshot) {
  const screenshotVariant = Object.keys(screenshot.sizes).map((key) => {
    const width = key.split("x")[0]
    const widthNumber = parseInt(width)

    const height = key.split("x")[1]
    const heightNumber = parseInt(height)

    return {
      src: screenshot.sizes[key],
      width: widthNumber,
      height: heightNumber,
      caption: screenshot.caption,
    }
  })

  if (screenshotVariant.length === 0) {
    return undefined
  }

  return {
    ...screenshotVariant[0],
    srcSet: screenshotVariant,
  }
}

export interface Release {
  description?: string
  timestamp?: number
  date?: Date
  type?: "stable" | "development"
  urgency?: "low" | "medium" | "high" | "critical"
  version: string
  url?: string
  date_eol?: Date
}

export interface Launchable {
  value: string
  type: string
}

export interface Bundle {
  value: string
  type: string
  runtime: string
  sdk: string
}

export interface Metadata {
  "flathub::manifest"?: string
  "flathub::verification::verified": string | undefined
  "flathub::verification::method":
    | undefined
    | "manual"
    | "website"
    | "login_provider"
  "flathub::verification::login_name": string
  "flathub::verification::login_provider": string
  "flathub::verification::website": string
  "flathub::verification::timestamp": string
  "flathub::verification::login_is_organization": string
}
