import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { http, HttpResponse } from "msw"
import { expect, userEvent, within } from "storybook/test"
import countriesAtlas from "src/data/countries.topo.json"
import { UserContext } from "../../../src/context/user-info"
import {
  Permission,
  type StatsResult,
  type UserInfo,
} from "../../../src/codegen"
import StatisticsClient, { DownloadsPerCountry } from "./statistics-client"

const meta = {
  title: "Pages/Statistics/Charts",
  component: StatisticsClient,
  parameters: {
    nextjs: { appDirectory: true },
    msw: {
      handlers: [
        http.get("*/quality-moderation/failed-by-guideline", () =>
          HttpResponse.json([
            { guideline_id: "app-name", not_passed: 64 },
            { guideline_id: "app-icon", not_passed: 42 },
            { guideline_id: "screenshots", not_passed: 27 },
            { guideline_id: "app-description", not_passed: 18 },
          ]),
        ),
        http.get("*/quality-moderation/stats-by-category", () =>
          HttpResponse.json([
            { category: "metadata", passed: 212, not_passed: 38, unrated: 17 },
            {
              category: "app-content",
              passed: 174,
              not_passed: 29,
              unrated: 24,
            },
            {
              category: "permissions",
              passed: 126,
              not_passed: 18,
              unrated: 31,
            },
            { category: "branding", passed: 98, not_passed: 21, unrated: 12 },
          ]),
        ),
      ],
    },
  },
  decorators: [
    (Story) => (
      <UserContext.Provider
        value={{
          loading: false,
          info: {
            permissions: [Permission["quality-moderation"]],
          } as UserInfo,
        }}
      >
        <Story />
      </UserContext.Provider>
    ),
  ],
} satisfies Meta<typeof StatisticsClient>

export default meta
type Story = StoryObj<typeof meta>

const stats = {
  totals: { downloads: 582_430_210, number_of_apps: 2_645, verified_apps: 427 },
  countries: {
    US: 240_000,
    DE: 185_000,
    FR: 124_000,
    GB: 117_000,
    JP: 98_000,
    CA: 77_000,
  },
  downloads_per_day: {
    "2024-01-01": 1_140_000,
    "2024-01-02": 1_210_000,
    "2024-01-03": 1_340_000,
    "2024-01-04": 1_420_000,
    "2024-01-05": 1_390_000,
    "2024-01-06": 1_280_000,
    "2024-01-07": 1_160_000,
    "2024-01-08": 1_030_000,
    "2024-01-09": 940_000,
    "2024-01-10": 990_000,
    "2024-01-11": 1_120_000,
    "2024-01-12": 1_290_000,
    "2024-01-13": 1_440_000,
    "2024-01-14": 1_470_000,
    "2024-01-15": 1_350_000,
  },
  updates_per_day: {},
  delta_downloads_per_day: {},
  category_totals: [
    { category: "audiovideo", count: 242 },
    { category: "development", count: 198 },
    { category: "education", count: 135 },
    { category: "game", count: 384 },
    { category: "graphics", count: 115 },
    { category: "network", count: 120 },
    { category: "office", count: 109 },
    { category: "science", count: 62 },
    { category: "system", count: 141 },
    { category: "utility", count: 178 },
  ],
  os_versions: {
    "fedora;42": 482_000,
    "fedora;41": 284_000,
    "ubuntu;24": 228_000,
    "bazzite;42": 174_000,
    "arch;unknown": 146_000,
    "debian;13": 104_000,
    "nixos;25": 75_000,
    "opensuse;16": 62_000,
    "linuxmint;22": 52_000,
    "other;unknown": 41_000,
  },
  flatpak_versions: {
    "1.16": 540_000,
    "1.15": 185_000,
    "1.14": 72_000,
    "1.12": 28_000,
  },
  os_flatpak_versions: {
    "fedora;42": { "1.16": 68, "1.15": 24, "1.14": 8 },
    "ubuntu;24": { "1.16": 54, "1.15": 35, "1.14": 11 },
    "bazzite;42": { "1.16": 81, "1.15": 15, "1.14": 4 },
    "arch;unknown": { "1.16": 75, "1.15": 20, "1.14": 5 },
  },
} satisfies StatsResult

const runtimes = {
  "org.gnome.Platform/x86_64/47": 624,
  "org.freedesktop.Platform/x86_64/24.08": 502,
  "org.kde.Platform/x86_64/6.9": 371,
  "org.gnome.Platform/x86_64/46": 294,
  "org.freedesktop.Platform/x86_64/23.08": 183,
  "org.kde.Platform/x86_64/6.8": 142,
}

export const AllCharts: Story = {
  args: {
    stats,
    runtimes,
    locale: "en",
    countryNames: {
      US: "United States",
      DE: "Germany",
      FR: "France",
      GB: "United Kingdom",
      JP: "Japan",
      CA: "Canada",
    },
  },
}

export const PopulationComparison: Story = {
  args: {
    ...AllCharts.args,
    stats: {
      ...stats,
      countries: { US: 200, DE: 100, AX: 50, FR: 0 },
      country_population: {
        year: 2026,
        revision: "2024 (revision 1)",
        populations: { US: 1_000_000, DE: 100_000, FR: 100_000 },
      },
    },
    countryNames: {
      US: "United States",
      DE: "Germany",
      AX: "Åland Islands",
      FR: "France",
    },
  },
  render: (args) => (
    <div className="mx-auto max-w-5xl px-4">
      <DownloadsPerCountry
        stats={args.stats}
        countryNames={args.countryNames}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByRole("switch", { name: "Per 100,000 people" })
    expect(toggle).not.toBeChecked()
    const totalList = canvas.getByRole("list", { name: "Total downloads" })
    expect(within(totalList).getAllByRole("listitem")[0]).toHaveTextContent(
      "United States",
    )

    await userEvent.click(toggle)
    expect(toggle).toBeChecked()
    const normalizedList = canvas.getByRole("list", {
      name: "Per 100,000 people",
    })
    const rows = within(normalizedList).getAllByRole("listitem")
    expect(rows[0]).toHaveTextContent("Germany")
    expect(rows[1]).toHaveTextContent("United States")
    expect(rows[1]).toHaveTextContent("20")
    expect(within(rows[1]).getByText("200 total")).toBeVisible()
    expect(within(rows[1]).getByText("200 downloads")).toHaveClass("sr-only")
    expect(rows[2]).toHaveTextContent("France")
    expect(rows[2]).not.toHaveTextContent("Population data unavailable")
    expect(rows[3]).toHaveTextContent("Åland Islands")
    expect(rows[3]).toHaveTextContent("Population data unavailable")
    expect(within(rows[3]).getByText("50 total")).toBeVisible()
    expect(within(rows[3]).getByText("50 downloads")).toHaveClass("sr-only")

    toggle.focus()
    await userEvent.keyboard("[Space]")
    expect(toggle).not.toBeChecked()
    expect(
      within(
        canvas.getByRole("list", { name: "Total downloads" }),
      ).getAllByRole("listitem")[0],
    ).toHaveTextContent("United States")
  },
}

export const WithoutPopulationData: Story = {
  ...PopulationComparison,
  args: {
    ...PopulationComparison.args,
    stats: { ...stats, country_population: null },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByRole("switch")).toBeDisabled()
    expect(canvas.getByRole("list", { name: "Total downloads" })).toBeVisible()
  },
}

const mapCountryCodes = countriesAtlas.objects.countries.geometries.map(
  (country) => country.properties.countryCode,
)
const mapRegionNames = new Intl.DisplayNames("en", { type: "region" })

export const LongCountryList: Story = {
  ...PopulationComparison,
  args: {
    ...PopulationComparison.args,
    stats: {
      ...stats,
      countries: Object.fromEntries(
        mapCountryCodes.map((country, i) => [country, (i + 1) * 50_000]),
      ),
      country_population: {
        year: 2026,
        revision: "2024 (revision 1)",
        populations: Object.fromEntries(
          mapCountryCodes.map((country) => [country, 1_000_000]),
        ),
      },
    },
    countryNames: Object.fromEntries(
      mapCountryCodes.map((country) => [
        country,
        mapRegionNames.of(country) ?? country,
      ]),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const list = canvas.getByRole("list", { name: "Total downloads" })
    expect(within(list).getAllByRole("listitem")).toHaveLength(
      mapCountryCodes.length,
    )
    expect(list.scrollHeight).toBeGreaterThan(list.clientHeight)
    expect(list.clientHeight).toBeGreaterThan(0)
    expect(list.clientHeight).toBeLessThanOrEqual(500)
    expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth,
    )
    await userEvent.click(canvas.getByRole("switch"))
    expect(
      canvas.getByRole("list", { name: "Per 100,000 people" }).clientHeight,
    ).toBeLessThanOrEqual(500)
  },
}
