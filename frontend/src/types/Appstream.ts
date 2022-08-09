export type AppstreamListItem = Pick<
  Appstream,
  "id" | "summary" | "icon" | "name"
>

export interface Appstream {
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
  "112x63"?: string
  "224x126"?: string
  "624x351"?: string
  "752x423"?: string
  "1248x702"?: string
  "1504x846"?: string
}

export function pickScreenshot(screenshot: Screenshot) {
  if (screenshot["1504x846"]) {
    return { url: screenshot["1504x846"], width: 1504, height: 846 }
  } else if (screenshot["1248x702"]) {
    return { url: screenshot["1248x702"], width: 1248, height: 702 }
  } else if (screenshot["752x423"]) {
    return { url: screenshot["752x423"], width: 752, height: 423 }
  } else if (screenshot["624x351"]) {
    return { url: screenshot["624x351"], width: 624, height: 351 }
  } else if (screenshot["224x126"]) {
    return { url: screenshot["224x126"], width: 224, height: 126 }
  } else if (screenshot["112x63"]) {
    return { url: screenshot["112x63"], width: 112, height: 63 }
  } else {
    return undefined
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
  "Flathub::manifest"?: string
}
