"use client"

import { useMemo, useRef, type PointerEvent } from "react"
import { scaleSequential } from "d3-scale"
import { geoMercator, geoNaturalEarth1 } from "d3-geo"
import { useLocale, useTranslations } from "next-intl"
import { Chart } from "@tanstack/charts/react"
import { defineChart, type ChartRenderContext } from "@tanstack/charts"
import { geoShape } from "@tanstack/charts/geo"
import { tooltip } from "@tanstack/charts/tooltip"
import { portal } from "@tanstack/charts/tooltip/portal"
import { feature } from "topojson-client"
import type { Feature, Geometry } from "geojson"
import type {
  GeometryCollection,
  Objects,
  Topology,
} from "topojson-specification"
import countriesAtlas from "src/data/countries.topo.json"

interface CountryProperties {
  countryCode: string
  value: number | null
}

type CountryFeature = Feature<Geometry, CountryProperties>
type WorldObjects = Objects & {
  countries: GeometryCollection<{ countryCode: string }>
}

const topology = countriesAtlas as unknown as Topology<WorldObjects>
const atlasFeatures = feature(topology, topology.objects.countries)

const countryFeatures: CountryFeature[] = atlasFeatures.features.map(
  (country) => ({
    ...country,
    properties: { countryCode: country.properties.countryCode, value: 0 },
  }),
)

export interface CountryMapValue {
  country: string
  value: number | null
}

export const COUNTRY_MAP_NO_DATA_COLOR = "oklch(var(--muted-foreground) / 0.35)"

interface CountryMapProps {
  data: CountryMapValue[]
  ariaLabel?: string
  onCountrySelect?: (countryCode: string) => void
  showTooltip?: boolean
  metric?:
    "downloads" | "installs" | "downloads-per-capita" | "installs-per-capita"
  totals?: Record<string, number>
  compact?: boolean
}

export default function CountryMap({
  data,
  ariaLabel,
  onCountrySelect,
  showTooltip = true,
  metric = "downloads",
  totals,
  compact = false,
}: CountryMapProps) {
  const locale = useLocale()
  const t = useTranslations()
  const renderContextRef = useRef<ChartRenderContext<
    CountryFeature,
    number,
    number
  > | null>(null)
  const getCountryCode = (target: EventTarget | null) => {
    if (!(target instanceof Element)) {
      return null
    }
    const key = target
      .closest(".ts-chart__geo [data-ts-key]")
      ?.getAttribute("data-ts-key")
    return key?.slice(key.lastIndexOf(":") + 1) ?? null
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const context = renderContextRef.current
    if (!context) {
      return
    }
    const countryCode = getCountryCode(event.target)
    const point = context.scene.points.find(
      (candidate) => candidate.datum.properties.countryCode === countryCode,
    )
    context.interaction.setControlledFocus(point ?? null, { source: "pointer" })
  }

  const definition = useMemo(() => {
    const valuesByCountry = new Map(
      data.map(({ country, value }) => [country.toUpperCase(), value]),
    )
    const totalsByCountry = new Map(
      Object.entries(totals ?? {}).map(([country, value]) => [
        country.toUpperCase(),
        value,
      ]),
    )
    const rows = countryFeatures.map((country) => ({
      ...country,
      properties: {
        ...country.properties,
        value: valuesByCountry.has(country.properties.countryCode)
          ? valuesByCountry.get(country.properties.countryCode)!
          : metric.endsWith("-per-capita")
            ? null
            : 0,
      },
    }))
    const maxValue = Math.max(0, ...data.map(({ value }) => value ?? 0)) || 1
    const colorScale = scaleSequential((value) => {
      const percentage = value > 0 ? 20 + value * 80 : 0
      return `color-mix(in oklab, oklch(var(--bg-color-secondary)), oklch(var(--color-primary)) ${percentage}%)`
    }).domain([0, maxValue])
    const regionNames = new Intl.DisplayNames(locale, { type: "region" })
    const fallbackRegionNames = new Intl.DisplayNames("en", { type: "region" })

    return defineChart({
      marks: [
        geoShape(rows, {
          key: (country) => country.properties.countryCode,
          projection: ({ chart }) => {
            if (compact) {
              return geoNaturalEarth1().fitExtent(
                [
                  [8, 8],
                  [chart.width - 8, chart.height - 8],
                ],
                { type: "FeatureCollection", features: rows },
              )
            }
            // Preserve the previous map's 960px-wide Mercator frame and
            // its 240px vertical offset from D3's default translation.
            const projectionScale = geoMercator().scale()
            const scale = (projectionScale * chart.width) / 960

            return geoMercator()
              .scale(scale)
              .translate([chart.width / 2, (chart.width * 490) / 960])
              .clipExtent([
                [0, 0],
                [chart.width, chart.height],
              ])
          },
          color: (country) => country.properties.value,
          fill: (country) =>
            country.properties.value === null
              ? COUNTRY_MAP_NO_DATA_COLOR
              : colorScale(country.properties.value),
          stroke: "oklch(var(--text-primary))",
          strokeOpacity: 0.45,
          strokeWidth: 0.45,
          states: [
            {
              when: { focus: "primary" },
              style: {
                stroke: "oklch(var(--text-primary))",
                strokeOpacity: 1,
                strokeWidth: 1.5,
              },
            },
          ],
        }),
      ],
      scales: { x: null, y: null },
      color: { scale: () => colorScale },
      margin: 0,
      focusRing: false,
      pointer: false,
      focus: showTooltip ? "nearest" : false,
      tooltip: showTooltip
        ? {
            use: tooltip,
            portal,
            format: (point) => {
              const { countryCode, value } = point.datum.properties
              const countryName =
                regionNames.of(countryCode) ??
                fallbackRegionNames.of(countryCode) ??
                t("unknown")
              const total = totals
                ? ` (${t("country-downloads.x-total", {
                    x: (totalsByCountry.get(countryCode) ?? 0).toLocaleString(
                      locale,
                    ),
                  })})`
                : ""
              if (value === null) {
                return `${countryName}: ${t("country-downloads.population-unavailable")}${total}`
              }
              const formattedValue = value.toLocaleString(locale, {
                minimumFractionDigits: metric.endsWith("-per-capita") ? 2 : 0,
                maximumFractionDigits: metric.endsWith("-per-capita") ? 2 : 0,
              })
              const valueText =
                metric === "downloads-per-capita"
                  ? t("country-downloads.x-per-100000", { x: formattedValue })
                  : metric === "installs-per-capita"
                    ? t("country-installs.x-per-100000", { x: formattedValue })
                    : metric === "downloads"
                      ? t("x-downloads", { x: formattedValue, count: value })
                      : t("x-installs", { x: formattedValue, count: value })
              return `${countryName}: ${valueText}${total}`
            },
          }
        : undefined,
    })
  }, [data, locale, metric, showTooltip, t, totals, compact])

  return (
    <div
      className="w-full overflow-hidden rounded-xl [&_.ts-chart:focus:not(:focus-visible)]:outline-none [&_.ts-chart__geo_path]:cursor-pointer"
      onPointerMove={handlePointerMove}
      onPointerLeave={() =>
        renderContextRef.current?.interaction.setControlledFocus(null)
      }
      onClickCapture={(event) => {
        const countryCode = getCountryCode(event.target)
        if (countryCode) {
          onCountrySelect?.(countryCode)
        }
      }}
    >
      <Chart
        definition={definition}
        aspectRatio={compact ? 2 : 4 / 3}
        initialWidth={600}
        ariaLabel={
          ariaLabel ??
          (metric === "downloads-per-capita"
            ? t("country-downloads.per-capita-map-label")
            : metric === "installs-per-capita"
              ? t("country-installs.per-capita-map-label")
              : t("downloads-per-country"))
        }
        onRender={(context) => {
          renderContextRef.current = context
        }}
        onSelect={(point) => {
          if (point) {
            onCountrySelect?.(point.datum.properties.countryCode)
          }
        }}
      />
    </div>
  )
}
