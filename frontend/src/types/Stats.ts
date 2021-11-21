export interface Stats {
  countries: { [key: string]: number }
  downloads: { [key: string]: number }
  updates: { [key: string]: number }
  delta_downloads: { [key: string]: number }
}
