export interface Stats {
  countries: { [key: string]: number }
  downloads_per_day: { [key: string]: number }
  updates_per_day: { [key: string]: number }
  delta_downloads_per_day: { [key: string]: number }
  downloads: number
  number_of_apps: number
  category_totals: { [key: string]: number }
}
