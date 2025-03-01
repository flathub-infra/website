import { AppstreamListItem } from "./types/Appstream"
import { AppsIndex, MeilisearchResponseAppsIndex } from "./codegen"

export function mapAppsIndexToAppstreamListItem(
  app: AppsIndex,
): AppstreamListItem {
  return {
    id: app.app_id,
    name: app.name,
    summary: app.summary,
    icon: app.icon,
    metadata: {
      "flathub::verification::verified": app.verification_verified,
      "flathub::verification::method": app.verification_method,
      "flathub::verification::login_name": app.verification_login_name,
      "flathub::verification::login_provider": app.verification_login_provider,
      "flathub::verification::website": app.verification_website,
      "flathub::verification::timestamp": app.verification_timestamp,
      "flathub::verification::login_is_organization":
        app.verification_login_is_organization,
    },
  }
}

export function removeAppIdFromSearchResponse(
  response: MeilisearchResponseAppsIndex | undefined,
  app_id: string,
): MeilisearchResponseAppsIndex | null {
  if (!response) {
    return null
  }

  const newHits = response.hits.filter((app) => app.app_id !== app_id)

  return {
    ...response,
    totalHits: newHits.length,
    hits: newHits,
  }
}
