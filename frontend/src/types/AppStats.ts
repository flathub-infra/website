export interface AppStats {
  installs_last_month: number
  installs_total: number
  installs_last_7_days: number
  installs_per_day: { [key: string]: number }
}
