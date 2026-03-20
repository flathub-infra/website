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
  ContentRatingLevel,
} from "src/types/Appstream"
import { GetAppstreamAppstreamAppIdGet200 } from "src/codegen"
import { bcpToPosixLocale } from "./localize"

export interface ContentRatingDisplay {
  minimumAge: number | null
  minimumAgeText: string | null
  attrs: ContentRatingDetailsItem[]
}

export interface ContentRatingDetailsItem {
  attr: string
  level: ContentRatingLevel
  description: string
}

export type OarsCategory =
  | "violence"
  | "drugs"
  | "sex"
  | "language"
  | "social"
  | "money"

export interface ContentRatingCategory {
  category: OarsCategory
  /** Worst (highest) level among all attrs in this category */
  level: ContentRatingLevel
  /** All per-attribute descriptions for this category */
  descriptions: string[]
  /** True when all attrs in this category are rated 'none' or absent */
  isEmpty: boolean
}

const LEVEL_ORDER: ContentRatingLevel[] = [
  ContentRatingLevel.none,
  ContentRatingLevel.mild,
  ContentRatingLevel.moderate,
  ContentRatingLevel.intense,
]

function worstLevel(
  a: ContentRatingLevel,
  b: ContentRatingLevel,
): ContentRatingLevel {
  return LEVEL_ORDER.indexOf(a) >= LEVEL_ORDER.indexOf(b) ? a : b
}

function attrCategory(attr: string): OarsCategory | null {
  const hyphen = attr.replace(/_/g, "-")
  if (hyphen.startsWith("violence-")) return "violence"
  if (hyphen.startsWith("drugs-")) return "drugs"
  if (hyphen.startsWith("sex-")) return "sex"
  if (hyphen.startsWith("language-")) return "language"
  if (hyphen.startsWith("social-")) return "social"
  if (hyphen.startsWith("money-")) return "money"
  return null
}

const CATEGORY_ORDER: OarsCategory[] = [
  "drugs",
  "language",
  "money",
  "sex",
  "social",
  "violence",
]

export function groupContentRatingByCategory(
  attrs: ContentRatingDetailsItem[],
): ContentRatingCategory[] {
  const map = new Map<OarsCategory, ContentRatingCategory>()

  for (const { attr, level, description } of attrs) {
    const category = attrCategory(attr)
    if (!category) continue

    // Skip none-level attrs — they don't contribute descriptions
    if (level === ContentRatingLevel.none) {
      // Ensure the category exists as empty if not yet present
      if (!map.has(category)) {
        map.set(category, {
          category,
          level: ContentRatingLevel.none,
          descriptions: [],
          isEmpty: true,
        })
      }
      continue
    }

    const existing = map.get(category)
    if (existing) {
      existing.level = worstLevel(existing.level, level)
      existing.descriptions.push(description)
      existing.isEmpty = false
    } else {
      map.set(category, {
        category,
        level,
        descriptions: [description],
        isEmpty: false,
      })
    }
  }

  // Return ALL categories in fixed display order; absent ones are green/empty
  return CATEGORY_ORDER.map((cat) => {
    return (
      map.get(cat) ?? {
        category: cat,
        level: ContentRatingLevel.none,
        descriptions: [],
        isEmpty: true,
      }
    )
  })
}

// Human-readable descriptions for OARS attributes, keyed by "attr:level"
// These match what libappstream's ContentRating.attribute_get_description() returns in English
const oarsDescriptions: Record<string, string> = {
  "violence-cartoon:mild": "Cartoon characters in unsafe situations",
  "violence-cartoon:moderate": "Cartoon characters in aggressive conflict",
  "violence-cartoon:intense": "Graphic violence involving cartoon characters",
  "violence-fantasy:mild": "Characters in unsafe situations easily distinguishable from reality",
  "violence-fantasy:moderate": "Characters in aggressive conflict easily distinguishable from reality",
  "violence-fantasy:intense": "Graphic violence easily distinguishable from reality",
  "violence-realistic:mild": "Mildly realistic characters in unsafe situations",
  "violence-realistic:moderate": "Depictions of realistic characters in aggressive conflict",
  "violence-realistic:intense": "Graphic violence involving realistic characters",
  "violence-bloodshed:mild": "Unrealistic bloodshed",
  "violence-bloodshed:moderate": "Realistic bloodshed",
  "violence-bloodshed:intense": "Depictions of bloodshed and the mutilation of body parts",
  "violence-sexual:intense": "Rape or other violent sexual behavior",
  "violence-desecration:mild": "Visible dead human remains",
  "violence-desecration:moderate": "Dead human remains that are exposed to the elements",
  "violence-desecration:intense": "Graphic depictions of desecration of human bodies",
  "violence-slavery:mild": "Depictions of or references to historical slavery",
  "violence-slavery:moderate": "Depictions of modern-day slavery",
  "violence-slavery:intense": "Graphic depictions of modern-day slavery",
  "violence-worship:mild": "Depictions of or references to historical desecration",
  "violence-worship:moderate": "Depictions of modern-day human desecration",
  "violence-worship:intense": "Graphic depictions of modern-day desecration",
  "drugs-alcohol:mild": "References to alcoholic beverages",
  "drugs-alcohol:moderate": "Use of alcoholic beverages",
  "drugs-alcohol:intense": "Use of alcoholic beverages",
  "drugs-narcotics:mild": "References to illicit drugs",
  "drugs-narcotics:moderate": "Use of illicit drugs",
  "drugs-narcotics:intense": "Use of illicit drugs",
  "drugs-tobacco:mild": "References to tobacco products",
  "drugs-tobacco:moderate": "Use of tobacco products",
  "drugs-tobacco:intense": "Use of tobacco products",
  "sex-nudity:mild": "Brief artistic nudity",
  "sex-nudity:moderate": "Prolonged nudity",
  "sex-nudity:intense": "Explicit nudity involving visible sexual organs",
  "sex-themes:mild": "Provocative references or depictions",
  "sex-themes:moderate": "Sexual references or depictions",
  "sex-themes:intense": "Graphic sexual behavior",
  "sex-homosexuality:mild": "Indirect references to homosexuality",
  "sex-homosexuality:moderate": "Kissing between people of the same gender",
  "sex-homosexuality:intense": "Graphic sexual behavior between people of the same gender",
  "sex-prostitution:mild": "Indirect references to prostitution",
  "sex-prostitution:moderate": "Direct references to prostitution",
  "sex-prostitution:intense": "Graphic depictions of the act of prostitution",
  "sex-adultery:mild": "Indirect references to adultery",
  "sex-adultery:moderate": "Direct references to adultery",
  "sex-adultery:intense": "Graphic depictions of the act of adultery",
  "sex-appearance:moderate": "Scantily clad human characters",
  "sex-appearance:intense": "Overtly sexualized human characters",
  "language-profanity:mild": "Mild or infrequent use of profanity",
  "language-profanity:moderate": "Moderate use of profanity",
  "language-profanity:intense": "Strong or frequent use of profanity",
  "language-humor:mild": "Slapstick humor",
  "language-humor:moderate": "Vulgar or bathroom humor",
  "language-humor:intense": "Mature or sexual humor",
  "language-discrimination:mild": "Negativity towards a specific group of people",
  "language-discrimination:moderate": "Discrimination designed to cause emotional harm",
  "language-discrimination:intense": "Explicit discrimination based on gender, sexuality, race or religion",
  "social-chat:mild": "User-to-user interactions without chat functionality",
  "social-chat:moderate": "Moderated chat functionality between users",
  "social-chat:intense": "Uncontrolled chat functionality between users",
  "social-info:mild": "Checking for the latest application version",
  "social-info:moderate": "Sharing diagnostic data that does not let others identify the user",
  "social-info:intense": "Sharing information that lets others identify the user",
  "social-audio:moderate": "Moderated audio or video chat functionality between users",
  "social-audio:intense": "Uncontrolled audio or video chat functionality between users",
  "social-location:intense": "Sharing physical location with other users",
  "social-contacts:intense": "Sharing social network usernames or email addresses",
  "money-purchasing:mild": "Users are encouraged to donate real money",
  "money-purchasing:moderate": "Users are encouraged to donate real money",
  "money-purchasing:intense": "Ability to spend real money in-app",
  "money-gambling:mild": "Gambling on random events using tokens or credits",
  "money-gambling:moderate": "Gambling using \"play\" money",
  "money-gambling:intense": "Gambling using real money",
}

function oarsAttrDescription(attr: string, level: string): string {
  // attr may use underscores (from old content_rating) or hyphens (from content_rating_details)
  const hyphenAttr = attr.replace(/_/g, "-")
  return oarsDescriptions[`${hyphenAttr}:${level}`] ?? hyphenAttr
}

export function getContentRating(
  data: GetAppstreamAppstreamAppIdGet200,
  locale?: string,
): ContentRatingDisplay | null {
  // Use the new content_rating_details field if available
  if ("content_rating_details" in data && data.content_rating_details) {
    // Convert BCP-47 locale (e.g. "de") to POSIX (e.g. "de_DE") for DB key lookup
    const posixLocale = locale ? bcpToPosixLocale(locale) : "en_US"
    const localeData = (
      data.content_rating_details[posixLocale] ||
      data.content_rating_details["en_US"] ||
      Object.values(data.content_rating_details)[0]
    ) as any

    if (localeData && localeData.details !== undefined) {
      const attrs: ContentRatingDetailsItem[] = localeData.details.map(
        (detail: any) => ({
          attr: detail.id as string,
          level: detail.level as ContentRatingLevel,
          description: detail.description || oarsAttrDescription(detail.id, detail.level),
        }),
      )

      return {
        minimumAge: localeData.minimumAge ?? null,
        minimumAgeText: localeData.minimumAgeText ?? null,
        attrs,
      }
    }
  }

  // Fallback to old content_rating format (no locale-specific age rating system)
  if (!("content_rating" in data) || !data.content_rating) {
    return null
  }

  const attrs: ContentRatingDetailsItem[] = []

  for (const [attr, level] of Object.entries(data.content_rating)) {
    if (attr === "type" || !level || level === "none") {
      continue
    }

    const ratingLevel = level as ContentRatingLevel

    attrs.push({
      attr: attr as string,
      level: ratingLevel,
      description: oarsAttrDescription(attr, ratingLevel),
    })
  }

  return {
    minimumAge: null,
    minimumAgeText: null,
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

export function contentRatingToIcon(attr: string): JSX.Element {
  switch (attr) {
    case "violence-cartoon":
    case "violence-fantasy":
    case "violence-realistic":
    case "violence-bloodshed":
    case "violence-sexual":
    case "violence-desecration":
    case "violence-slavery":
    case "violence-worship":
      return <SwordsIcon className="h-full w-full" />
    case "drugs-alcohol":
    case "drugs-narcotics":
    case "drugs-tobacco":
      return <BeerIcon className="h-full w-full" />
    case "sex-nudity":
    case "sex-themes":
    case "sex-homosexuality":
    case "sex-prostitution":
    case "sex-adultery":
    case "sex-appearance":
      return <UsersIcon className="h-full w-full" />
    case "language-profanity":
    case "language-humor":
    case "language-discrimination":
      return <MessageCircleIcon className="h-full w-full" />
    case "social-chat":
    case "social-info":
    case "social-audio":
    case "social-location":
    case "social-contacts":
      return <MessageCircleIcon className="h-full w-full" />
    case "money-purchasing":
    case "money-gambling":
      return <BanknoteIcon className="h-full w-full" />
    default:
      return <SkullIcon className="h-full w-full" />
  }
}

export function categoryToIcon(category: OarsCategory): JSX.Element {
  switch (category) {
    case "violence":
      return <SwordsIcon className="h-full w-full" />
    case "drugs":
      return <BeerIcon className="h-full w-full" />
    case "sex":
      return <UsersIcon className="h-full w-full" />
    case "language":
      return <MessageCircleIcon className="h-full w-full" />
    case "social":
      return <MessageCircleIcon className="h-full w-full" />
    case "money":
      return <BanknoteIcon className="h-full w-full" />
  }
}
