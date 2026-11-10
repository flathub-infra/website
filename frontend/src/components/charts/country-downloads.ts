export interface CountryDownload {
  country: string
  downloads: number
  value: number | null
}

export function getCountryDownloads(
  countries: Record<string, number>,
  populations: Record<string, number> | undefined,
  perCapita: boolean,
): CountryDownload[] {
  return Object.entries(countries)
    .map(([country, downloads]) => {
      const population = populations?.[country.toUpperCase()]
      return {
        country,
        downloads,
        value: perCapita
          ? population !== undefined &&
            Number.isFinite(population) &&
            population > 0
            ? (downloads / population) * 100_000
            : null
          : downloads,
      }
    })
    .sort((a, b) => {
      if (a.value === null) {
        return b.value === null ? 0 : 1
      }
      if (b.value === null) {
        return -1
      }
      return b.value - a.value
    })
}

export function getCountryMapValues(
  countries: readonly CountryDownload[],
  populations: Record<string, number> | undefined,
  perCapita: boolean,
): Pick<CountryDownload, "country" | "value">[] {
  const values = countries.map(({ country, value }) => ({ country, value }))
  if (perCapita && populations) {
    const reported = new Set(
      countries.map(({ country }) => country.toUpperCase()),
    )
    for (const [country, count] of Object.entries(populations)) {
      if (!reported.has(country) && Number.isFinite(count) && count > 0) {
        values.push({ country, value: 0 })
      }
    }
  }
  return values
}
