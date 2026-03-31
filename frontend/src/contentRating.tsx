import {
  BanknoteIcon,
  BeerIcon,
  MessageCircleIcon,
  SwordsIcon,
  UsersIcon,
} from "lucide-react"
import type { JSX } from "react"
import { ContentRatingLevel } from "src/types/Appstream"
import { GetAppstreamAppstreamAppIdGet200 } from "src/codegen"
import { bcpToPosixLocale } from "./localize"

export type OarsCategory =
  | "violence"
  | "drugs"
  | "sex"
  | "language"
  | "social"
  | "money"

export interface ContentRatingCategory {
  id: OarsCategory
  level: ContentRatingLevel
  description: string | null
}

export interface ContentRatingDisplay {
  minimumAge: number | null
  minimumAgeText: string | null
  categories: ContentRatingCategory[]
}

export function getContentRating(
  data: GetAppstreamAppstreamAppIdGet200,
  locale?: string,
): ContentRatingDisplay | null {
  if ("content_rating_details" in data && data.content_rating_details) {
    const posixLocale = locale ? bcpToPosixLocale(locale) : "en_US"
    const localeData = (data.content_rating_details[posixLocale] ||
      data.content_rating_details["en_US"] ||
      Object.values(data.content_rating_details)[0]) as any

    if (!localeData || localeData.categories === undefined) return null

    return {
      minimumAge: localeData.minimumAge ?? null,
      minimumAgeText: localeData.minimumAgeText ?? null,
      categories: localeData.categories.map((cat: any) => ({
        id: cat.id as OarsCategory,
        level: cat.level as ContentRatingLevel,
        description: cat.description ?? null,
      })),
    }
  }

  return null
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
      return "text-flathub-sonic-silver bg-flathub-gainsborow/60 dark:text-flathub-spanish-gray dark:bg-flathub-granite-gray/60"
  }
}

export function ageToColor(age: number | null): string {
  const effective = age === null ? 3 : Math.max(age, 3)
  if (effective <= 9)
    return "bg-flathub-gainsborow/60 dark:bg-flathub-granite-gray/60"
  if (effective <= 10)
    return "text-flathub-status-yellow bg-flathub-status-yellow/25 dark:bg-flathub-status-yellow-dark/25 dark:text-flathub-status-yellow-dark"
  if (effective <= 15)
    return "text-flathub-status-orange bg-flathub-status-orange/25 dark:bg-flathub-status-orange-dark/25 dark:text-flathub-status-orange-dark"
  return "text-flathub-status-red bg-flathub-status-red/25 dark:bg-flathub-status-red-dark/25 dark:text-flathub-status-red-dark"
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
