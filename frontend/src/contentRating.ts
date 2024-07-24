import { FaGun } from "react-icons/fa6";
import {
  Appstream,
  ContentRatingAttribute,
  ContentRatingLevel,
} from "src/types/Appstream"

interface ContentRatingDetails {
  minimumAge: string
  attrs: ContentRatingDetailsItem[]
}

interface ContentRatingDetailsItem {
  attr: ContentRatingAttribute
  level: ContentRatingLevel
  description: string
}

export async function getContentRating(data: Appstream): Promise<ContentRatingDisplay> {
  // TODO
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
      // TODO
      return ''
  }
}

export function contentRatingToIcon(attr: ContentRatingAttribute): JSX.Element {
  // TODO
  switch (attr) {
    default:
      return React.createElement(FaGun, {
        className: "w-full h-full",
      })
}
