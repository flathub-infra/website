import {
  BanknoteIcon,
  BeerIcon,
  MessageCircleIcon,
  SkullIcon,
  SwordsIcon,
  UsersIcon,
} from "lucide-react"
import type { JSX } from "react"
import {
  Appstream,
  ContentRatingAttribute,
  ContentRatingLevel,
} from "src/types/Appstream"

export interface ContentRatingDisplay {
  minimumAge: number
  attrs: ContentRatingDetailsItem[]
}

export interface ContentRatingDetailsItem {
  attr: ContentRatingAttribute
  level: ContentRatingLevel
  description: string
}

export function getContentRating(
  data: Appstream,
  locale?: string,
): ContentRatingDisplay | null {
  // Use the new content_rating_details field if available
  if ("content_rating_details" in data && data.content_rating_details) {
    const localeData = locale
      ? data.content_rating_details[locale] ||
        data.content_rating_details["en"] ||
        Object.values(data.content_rating_details)[0]
      : data.content_rating_details["en"] ||
        Object.values(data.content_rating_details)[0]

    if (localeData && localeData.details) {
      const attrs: ContentRatingDetailsItem[] = localeData.details.map(
        (detail: any) => ({
          attr: detail.id as ContentRatingAttribute,
          level: detail.level as ContentRatingLevel,
          description: detail.description || detail.id,
        }),
      )

      return {
        minimumAge: localeData.minimumAge || 0,
        attrs,
      }
    }
  }

  // Fallback to old content_rating format
  if (!("content_rating" in data) || !data.content_rating) {
    return null
  }

  const attrs: ContentRatingDetailsItem[] = []
  let minimumAge = 0

  for (const [attr, level] of Object.entries(data.content_rating)) {
    if (attr === "type" || !level || level === "none") {
      continue
    }

    const ratingLevel = level as ContentRatingLevel

    attrs.push({
      attr: attr as ContentRatingAttribute,
      level: ratingLevel,
      description: attr, // This will be translated in the component
    })

    let age = 0
    switch (ratingLevel) {
      case ContentRatingLevel.mild:
        age = 12
        break
      case ContentRatingLevel.moderate:
        age = 16
        break
      case ContentRatingLevel.intense:
        age = 18
        break
    }

    if (age > minimumAge) {
      minimumAge = age
    }
  }

  return {
    minimumAge,
    attrs,
  }
}

export function contentRatingToColor(level: ContentRatingLevel): string {
  switch (level) {
    case ContentRatingLevel.none:
      return `text-flathub-status-green bg-flathub-status-green/25 dark:bg-flathub-status-green-dark/25 dark:text-flathub-status-green-dark`
    case ContentRatingLevel.mild:
      return `text-flathub-status-yellow bg-flathub-status-yellow/25 dark:bg-flathub-status-yellow-dark/25 dark:text-flathub-status-yellow-dark`
    case ContentRatingLevel.moderate:
      return `text-flathub-status-orange bg-flathub-status-orange/25 dark:bg-flathub-status-orange-dark/25 dark:text-flathub-status-orange-dark`
    case ContentRatingLevel.intense:
      return `text-flathub-status-red bg-flathub-status-red/25 dark:bg-flathub-status-red-dark/25 dark:text-flathub-status-red-dark`
    case ContentRatingLevel.unknown:
      return ""
  }
}

export function contentRatingToIcon(attr: ContentRatingAttribute): JSX.Element {
  switch (attr) {
    case "violence_cartoon":
    case "violence_fantasy":
    case "violence_realistic":
    case "violence_bloodshed":
    case "violence_sexual":
    case "violence_desecration":
    case "violence_slavery":
    case "violence_worship":
      return <SwordsIcon className="h-full w-full" />
    case "drugs_alcohol":
    case "drugs_narcotics":
    case "drugs_tobacco":
      return <BeerIcon className="h-full w-full" />
    case "sex_nudity":
    case "sex_themes":
    case "sex_homosexuality":
    case "sex_prostitution":
    case "sex_adultery":
    case "sex_appearance":
      return <UsersIcon className="h-full w-full" />
    case "language_profanity":
    case "language_humor":
    case "language_discrimination":
      return <MessageCircleIcon className="h-full w-full" />
    case "social_chat":
    case "social_info":
    case "social_audio":
    case "social_location":
    case "social_contacts":
      return <MessageCircleIcon className="h-full w-full" />
    case "money_purchasing":
    case "money_gambling":
      return <BanknoteIcon className="h-full w-full" />
    default:
      return <SkullIcon className="h-full w-full" />
  }
}
