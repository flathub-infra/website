import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import CountryMap from "./country-map"

const meta = {
  component: CountryMap,
  title: "Components/UI/CountryMap",
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-2xl bg-flathub-white p-4 dark:bg-flathub-arsenic">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CountryMap>

export default meta

type Story = StoryObj<typeof meta>

export const SkewedDistribution: Story = {
  args: {
    metric: "installs",
    data: [
      { country: "US", value: 5000 },
      { country: "DE", value: 400 },
      { country: "BR", value: 100 },
      { country: "ZA", value: 70 },
      { country: "IN", value: 25 },
      { country: "AU", value: 10 },
      { country: "JP", value: 1 },
      { country: "CA", value: 0 },
    ],
  },
}
