"use client"

import { createRef, useId, useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import ReactCountryFlag from "react-country-flag"
import { cn } from "@/lib/utils"
import CountryMap, { type CountryMapValue } from "@/components/ui/country-map"
import type { CountryPopulation } from "src/codegen/model/countryPopulation"
import { getCountryDownloads, getCountryMapValues } from "./country-downloads"
import PopulationSource from "./PopulationSource"
import PopulationToggle from "./PopulationToggle"

export const FlathubWorldMap = ({
  country_data,
  refs,
  perCapita = false,
}: {
  country_data: CountryMapValue[]
  refs?: { [key: string]: React.RefObject<HTMLDivElement | null> }
  perCapita?: boolean
}) => (
  <CountryMap
    data={country_data}
    onCountrySelect={(country) =>
      refs?.[country]?.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      })
    }
    metric={perCapita ? "downloads-per-capita" : "downloads"}
  />
)

export default function CountryStatistics({
  stats,
  countryNames,
  metric = "downloads",
  periodLabel,
  normalization,
}: {
  stats: {
    countries?: Record<string, number>
    country_population?: CountryPopulation | null
  }
  countryNames?: Record<string, string>
  metric?: "downloads" | "installs"
  periodLabel?: string
  normalization?: { enabled: boolean; onChange: (enabled: boolean) => void }
}) {
  const t = useTranslations()
  const locale = useLocale()
  const headingId = useId()
  const descriptionId = useId()
  const [normalizePopulation, setNormalizePopulation] = useState(false)
  const population = stats.country_population
  const perCapita =
    (normalization?.enabled ?? normalizePopulation) && !!population
  const countries = getCountryDownloads(
    stats.countries ?? {},
    population?.populations,
    perCapita,
  )
  const mapValues = getCountryMapValues(
    countries,
    population?.populations,
    perCapita,
  )
  const regions = useMemo(
    () => new Intl.DisplayNames([locale, "en"], { type: "region" }),
    [locale],
  )
  const refs = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(stats.countries ?? {}).map((country) => [
          country.toUpperCase(),
          createRef<HTMLDivElement>(),
        ]),
      ),
    [stats.countries],
  )
  const totalLabel = t(
    metric === "installs"
      ? "country-installs.total-installs"
      : "country-downloads.total-downloads",
  )
  const valueLabel = perCapita ? t("country-downloads.per-100000") : totalLabel

  return (
    <section aria-labelledby={headingId}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2
            id={headingId}
            className="m-0 text-lg font-bold tracking-tight sm:text-xl"
          >
            {t(
              metric === "installs"
                ? "country-installs.title"
                : "downloads-per-country",
            )}
          </h2>
          <p
            id={descriptionId}
            className="mb-0 mt-1 text-sm text-foreground/70"
          >
            {t(
              metric === "installs"
                ? "country-installs.summary"
                : "country-downloads.summary",
            )}
          </p>
        </div>
        <PopulationToggle
          checked={perCapita}
          onCheckedChange={normalization?.onChange ?? setNormalizePopulation}
          disabled={!population}
          describedBy={descriptionId}
        />
      </div>
      <div className="grid overflow-hidden rounded-xl border border-border/60 bg-background lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col justify-between">
          <CountryMap
            compact
            data={mapValues}
            metric={
              perCapita
                ? metric === "installs"
                  ? "installs-per-capita"
                  : "downloads-per-capita"
                : metric
            }
            ariaLabel={
              metric === "installs"
                ? t(
                    perCapita
                      ? "country-installs.per-capita-map-label"
                      : "country-statistics",
                  )
                : undefined
            }
            totals={perCapita ? stats.countries : undefined}
            onCountrySelect={(country) =>
              refs[country]?.current?.scrollIntoView({
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "auto"
                  : "smooth",
                block: "nearest",
              })
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 pb-4 pt-2 text-xs text-foreground/70 sm:px-5">
            <div className="flex items-center gap-2">
              <span>{t("country-downloads.lower")}</span>
              <span
                aria-hidden="true"
                className="h-1.5 w-16 rounded-full rtl:rotate-180"
                style={{
                  background:
                    "linear-gradient(90deg, color-mix(in oklab, oklch(var(--bg-color-secondary)), oklch(var(--color-primary)) 20%), oklch(var(--color-primary)))",
                }}
              />
              <span>{t("country-downloads.higher")}</span>
            </div>
            {perCapita && (
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-sm bg-muted-foreground/35"
                />
                {t("country-downloads.population-unavailable")}
              </div>
            )}
          </div>
        </div>
        <div className="relative min-h-0 min-w-0 border-t border-border/60 lg:border-s lg:border-t-0">
          <div className="flex min-h-0 flex-col lg:absolute lg:inset-0">
            <div className="flex items-center justify-between gap-4 border-b border-border/60 px-4 py-3 text-xs text-foreground/70 sm:px-5">
              <span>{t("country-downloads.country")}</span>
              <span className="text-end">{valueLabel}</span>
            </div>
            {countries.length === 0 && (
              <p className="m-0 px-4 py-8 text-sm text-foreground/70 sm:px-5">
                {t("country-downloads.no-country-data")}
              </p>
            )}
            <div
              role="list"
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need a focus target to scroll country rankings.
              tabIndex={0}
              aria-label={valueLabel}
              className="min-h-0 max-h-80 overflow-y-auto px-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:max-h-none lg:flex-1 sm:px-5"
            >
              {countries.map(({ country, downloads, value }, i) => (
                <div
                  role="listitem"
                  key={country}
                  ref={refs[country.toUpperCase()]}
                  className={cn(
                    "grid grid-cols-[1rem_minmax(0,1fr)_minmax(4rem,auto)] items-center gap-2 py-3.5 text-sm",
                    i > 0 && "border-t border-border/40",
                    value === null &&
                      i > 0 &&
                      countries[i - 1].value !== null &&
                      "mt-1 border-border pt-4",
                  )}
                >
                  <span className="text-xs tabular-nums text-foreground/70">
                    {value !== null ? `${i + 1}.` : ""}
                  </span>
                  <div className="flex min-w-0 items-center gap-2">
                    <ReactCountryFlag
                      countryCode={country}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 break-words">
                      {countryNames?.[country] ??
                        (/^(?:[a-z]{2}|[0-9]{3})$/i.test(country)
                          ? regions.of(country.toUpperCase())
                          : undefined) ??
                        t("unknown")}
                    </span>
                  </div>
                  <div className="flex max-w-32 flex-col items-end text-end tabular-nums">
                    <span
                      className={cn(
                        "font-semibold",
                        value === null &&
                          "text-xs font-normal text-foreground/70",
                      )}
                    >
                      {value === null
                        ? t("country-downloads.population-unavailable")
                        : value.toLocaleString(locale, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: perCapita ? 2 : 0,
                          })}
                    </span>
                    {perCapita && (
                      <span className="mt-0.5 text-xs text-foreground/70">
                        <span aria-hidden="true">
                          {t("country-downloads.x-total", {
                            x: downloads.toLocaleString(locale),
                          })}
                        </span>
                        <span className="sr-only">
                          {t(
                            metric === "installs"
                              ? "x-installs"
                              : "x-downloads",
                            {
                              x: downloads.toLocaleString(locale),
                              count: downloads,
                            },
                          )}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {(perCapita || periodLabel) && (
        <div className="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-1">
          {perCapita && (
            <PopulationSource
              year={population.year}
              revision={population.revision}
            >
              <p>
                {t(
                  metric === "installs"
                    ? "country-installs.description"
                    : "country-downloads.methodology",
                )}
              </p>
            </PopulationSource>
          )}
          {periodLabel && (
            <p className="m-0 py-1 text-xs text-foreground/70">{periodLabel}</p>
          )}
        </div>
      )}
    </section>
  )
}
