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
  name: string
  summary: string
  installs_last_month: number
  keywords: string[] | null
  app_id: string
  description: string
  icon: string
  categories: string[] | null
  developer_name: string | null
  project_group: string | null
  verification_verified: boolean
  verification_method: "website" | "manual" | "login_provider" | null
  verification_login_name: string | null
  verification_login_provider: string | null
  verification_website: string | null
}

export function mapAppsIndexToAppstreamListItem(
  app: AppsIndex,
): AppstreamListItem {
  return {
    id: app.app_id,
    name: app.name,
    summary: app.summary,
    icon: app.icon,
    custom: {
      "flathub::verification::verified": app.verification_verified,
      "flathub::verification::method": app.verification_method,
      "flathub::verification::login_name": app.verification_login_name,
      "flathub::verification::login_provider": app.verification_login_provider,
      "flathub::verification::website": app.verification_website,
    },
  }
}
