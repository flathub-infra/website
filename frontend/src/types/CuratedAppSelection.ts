import type { AppstreamListItem } from "./Appstream"

export const HOMEPAGE_CURATED_APP_SELECTION_SLOTS = [
  "after-hero",
  "after-top-apps",
  "after-first-category-block",
] as const

export type HomepageCuratedAppSelectionSlot =
  (typeof HOMEPAGE_CURATED_APP_SELECTION_SLOTS)[number]

export interface HomepageCuratedAppSelection {
  id: number
  themeKey: string
  slot: HomepageCuratedAppSelectionSlot
  apps: AppstreamListItem[]
}

export type HomepageCuratedAppSelectionsBySlot = Partial<
  Record<HomepageCuratedAppSelectionSlot, HomepageCuratedAppSelection>
>
