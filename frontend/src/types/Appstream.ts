export type AppstreamListItem = Pick<
  Appstream,
  "id" | "summary" | "icon" | "name" | "metadata"
>

export type Appstream = DesktopAppstream | AddonAppstream

export type Icon = {
  url: string
  width: number
  height: number
  scale: number
  type: "remote" | "cached"
}

export interface DesktopAppstream {
  type: "desktop-application" | "console-application" | "desktop"
  description: string
  screenshots?: Screenshot[]
  releases: Release[]
  content_rating: ContentRating
  urls?: Urls
  icon: string
  icons: Icon[]
  id: string
  name: string
  summary: string
  developer_name: string
  categories: string[]
  kudos: string[]
  mimetypes: string[]
  project_license?: string
  provides: string[]
  launchable: Launchable
  bundle: Bundle
  metadata?: Metadata
  keywords?: string[]
  is_free_license: boolean
  branding?: Branding[]
}

export interface Branding {
  value: string
  scheme_preference: "light" | "dark"
  type: "primary"
}

export interface AddonAppstream {
  type: "addon"
  releases: Release[]
  content_rating: ContentRating
  urls: Urls
  icon?: any
  icons?: Icon[]
  id: string
  name: string
  summary: string
  developer_name: string
  project_license?: string
  extends: string
  bundle: Bundle
  metadata?: Metadata
  is_free_license: boolean
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

export type ContentRatingLevel = "none" | "mild" | "moderate" | "intense"

export type ContentRatingAttribute =
  | "violence-cartoon"
  | "violence-fantasy"
  | "violence-realistic"
  | "violence-bloodshed"
  | "violence-sexual"
  | "violence-desecration"
  | "violence-slavery"
  | "violence-worship"
  | "drugs-alcohol"
  | "drugs-narcotics"
  | "drugs-tobacco"
  | "sex-nudity"
  | "sex-themes"
  | "sex-homosexuality"
  | "sex-prostitution"
  | "sex-adultery"
  | "sex-appearance"
  | "language-profanity"
  | "language-humor"
  | "language-discrimination"
  | "social-chat"
  | "social-info"
  | "social-audio"
  | "social-location"
  | "social-contacts"
  | "money-purchasing"
  | "money-gambling"

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
  width: string
  height: string
  scale: string
  src: string
}

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
