import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, within } from "storybook/test"
import StatsModal from "./StatsModal"

const meta = {
  component: StatsModal,
  args: {
    isOpen: true,
    onClose: () => {},
    locale: "en",
    stats: {
      id: "org.example.App",
      installs_total: 1050,
      installs_last_month: 100,
      installs_last_7_days: 25,
      installs_per_day: {},
      installs_per_country: { US: 800, DE: 200, NF: 50 },
      country_population: {
        year: 2026,
        revision: "2024 (revision 1)",
        populations: { US: 1_000_000, DE: 100_000, CA: 100_000 },
      },
    },
  },
} satisfies Meta<typeof StatsModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const PerCapita: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    const toggle = canvas.getByRole("switch", { name: "Per 100,000 people" })
    await expect(toggle).not.toBeChecked()
    await userEvent.click(toggle)
    await expect(toggle).toBeChecked()
    const ranking = canvas.getByRole("list", { name: "Per 100,000 people" })
    await expect(within(ranking).getAllByRole("listitem")[0]).toHaveTextContent(
      "Germany",
    )
    await userEvent.click(canvas.getByText("Population data for 2026"))
    await expect(canvas.getByText(/Rates are not the percentage/)).toBeVisible()
    await expect(
      canvas.getByText(
        "United Nations World Population Prospects 2024 (revision 1)",
      ),
    ).toBeVisible()
    await userEvent.click(canvas.getByText("Population data for 2026"))
  },
}

export const PopulationUnavailable: Story = {
  args: { stats: { ...meta.args.stats, country_population: null } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await expect(canvas.getByRole("switch")).toBeDisabled()
  },
}

export const NoCountryData: Story = {
  args: { stats: { ...meta.args.stats, installs_per_country: {} } },
}

export const WithDownloadHistory: Story = {
  args: {
    stats: {
      ...meta.args.stats,
      installs_per_day: Object.fromEntries(
        Array.from({ length: 30 }, (_, day) => [
          `2026-10-${String(day + 1).padStart(2, "0")}`,
          100 + day * 5,
        ]),
      ),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await userEvent.click(
      canvas.getByRole("tab", { name: "Country Statistics" }),
    )
    await userEvent.click(canvas.getByRole("switch"))
    await userEvent.click(canvas.getByRole("tab", { name: "Statistics" }))
    await userEvent.click(
      canvas.getByRole("tab", { name: "Country Statistics" }),
    )
    await expect(canvas.getByRole("switch")).toBeChecked()
  },
}
