import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { http, HttpResponse } from "msw"
import { UserContext } from "../../../src/context/user-info"
import {
  Permission,
  type StatsResult,
  type UserInfo,
} from "../../../src/codegen"
import StatisticsClient from "./statistics-client"

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
