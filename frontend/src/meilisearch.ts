import { AppstreamListItem } from "./types/Appstream"

export interface MeilisearchResponse<T> {
  hits: T[]
  query: string
  processingTimeMs: number
  hitsPerPage: number
  page: number
  totalPages: number
  totalHits: number
}

export interface AppsIndex {
  /// Be careful, this is not the same as the flatpak app id use the app_id field instead
  id: string
  app_id: string
  name: string
  summary: string
  description: string
  icon: string
  keywords: string[] | null
  categories: string[] | null
  installs_last_month: number
}

export function mapAppsIndexToAppstreamListItem(
  app: AppsIndex,
): AppstreamListItem {
  return {
    id: app.app_id,
    name: app.name,
    summary: app.summary,
    icon: app.icon,
  }
}
