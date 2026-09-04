import type { DesktopAppstream } from "../codegen"
import { CuratedAppSelectionLayout } from "../codegen/model/curatedAppSelectionLayout"
import type { AppstreamListItem } from "./Appstream"

export const HOMEPAGE_CURATED_APP_SELECTION_SLOTS = [
  "after-hero",
  "after-top-apps",
  "after-first-category-block",
] as const

export type HomepageCuratedAppSelectionSlot =
  (typeof HOMEPAGE_CURATED_APP_SELECTION_SLOTS)[number]

export const HOMEPAGE_CURATED_APP_SELECTION_LAYOUTS = [
  CuratedAppSelectionLayout.grid,
  CuratedAppSelectionLayout.carousel,
] as const

export type HomepageCuratedAppSelectionLayout = CuratedAppSelectionLayout

export interface HomepageCuratedApp extends AppstreamListItem {
  isFullscreen: boolean
  branding?: DesktopAppstream["branding"]
  screenshots?: DesktopAppstream["screenshots"]
}

export interface HomepageCuratedAppSelection {
  id: number
  themeKey: string
  slot: HomepageCuratedAppSelectionSlot
  layout: HomepageCuratedAppSelectionLayout
  apps: HomepageCuratedApp[]
}

export type HomepageCuratedAppSelectionsBySlot = Partial<
  Record<HomepageCuratedAppSelectionSlot, HomepageCuratedAppSelection>
>
