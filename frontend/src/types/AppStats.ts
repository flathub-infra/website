export interface AppStats {
  downloads_last_month: number
  downloads_total: number
  downloads_last_7_days: number
  downloads_per_day: { [key: string]: number }
}
