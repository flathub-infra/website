/**
 * Generated by orval 🍺
 * Do not edit manually.
 * Flathub API
 * OpenAPI spec version: 0.1.0
 */
import type { StatsResultCategoryTotals } from "./statsResultCategoryTotals"
import type { StatsResultCountries } from "./statsResultCountries"
import type { StatsResultDeltaDownloadsPerDay } from "./statsResultDeltaDownloadsPerDay"
import type { StatsResultDownloadsPerDay } from "./statsResultDownloadsPerDay"
import type { StatsResultTotals } from "./statsResultTotals"
import type { StatsResultUpdatesPerDay } from "./statsResultUpdatesPerDay"

export interface StatsResult {
  category_totals: StatsResultCategoryTotals[]
  countries: StatsResultCountries
  delta_downloads_per_day: StatsResultDeltaDownloadsPerDay
  downloads_per_day: StatsResultDownloadsPerDay
  totals: StatsResultTotals
  updates_per_day: StatsResultUpdatesPerDay
}
