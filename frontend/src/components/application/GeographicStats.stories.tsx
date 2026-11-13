import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, within } from "storybook/test"
import { GeographicInsightsSection } from "./YearInReview"

const meta = {
  component: GeographicInsightsSection,
  args: {
    geographicStats: {
      total_countries: 8,
      top_countries: [
        { country_code: "US", downloads: 100_000 },
        { country_code: "DE", downloads: 9_000 },
        { country_code: "FR", downloads: 8_000 },
        { country_code: "JP", downloads: 7_000 },
        { country_code: "CA", downloads: 6_000 },
      ],
      top_countries_per_capita: [
        { country_code: "VA", downloads: 100, downloads_per_100000: 20_000 },
        {
          country_code: "US",
          downloads: 100_000,
          downloads_per_100000: 10_000,
        },
        { country_code: "DE", downloads: 9_000, downloads_per_100000: 9_000 },
        { country_code: "FR", downloads: 8_000, downloads_per_100000: 8_000 },
        { country_code: "JP", downloads: 7_000, downloads_per_100000: 7_000 },
      ],
      population_year: 2024,
      population_revision: "2024 (revision 1)",
      fastest_growing_regions: [
        {
          country_code: "DE",
          downloads: 9_000,
          previous_year_downloads: 3_000,
          growth: 6_000,
          growth_percentage: 200,
        },
        {
          country_code: "FR",
          downloads: 8_000,
          previous_year_downloads: 3_200,
          growth: 4_800,
          growth_percentage: 150,
        },
        {
          country_code: "JP",
          downloads: 7_000,
          previous_year_downloads: 3_684,
          growth: 3_316,
          growth_percentage: 90,
        },
        {
          country_code: "CA",
          downloads: 6_000,
          previous_year_downloads: 3_428,
          growth: 2_572,
          growth_percentage: 75,
        },
        {
          country_code: "NL",
          downloads: 5_000,
          previous_year_downloads: 3_125,
          growth: 1_875,
          growth_percentage: 60,
        },
      ],
    },
  },
} satisfies Meta<typeof GeographicInsightsSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const PerCapita: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByRole("switch", { name: "Per 100,000 people" })
    await expect(canvas.queryByText("Vatican City")).not.toBeInTheDocument()
    await userEvent.click(toggle)
    await expect(canvas.getByText("Vatican City")).toBeVisible()
    await expect(canvas.getByText("20,000")).toBeVisible()
    await expect(canvas.getByText("100 total")).toBeVisible()
    await userEvent.click(canvas.getByText("Population data for 2024"))
    await expect(canvas.getByText(/2024 midyear population/)).toBeVisible()
    await userEvent.click(canvas.getByText("Population data for 2024"))
    await userEvent.click(toggle)
    await expect(canvas.queryByText("Vatican City")).not.toBeInTheDocument()
    await userEvent.click(toggle)
  },
}

export const PopulationUnavailable: Story = {
  args: {
    geographicStats: {
      ...meta.args.geographicStats,
      top_countries_per_capita: null,
      population_year: null,
      population_revision: null,
    },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("switch")).toBeDisabled()
  },
}
