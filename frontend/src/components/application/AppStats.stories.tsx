import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import AppStats from "./AppStats"

const meta = {
  component: AppStats,
  title: "Components/Application/AppStats",
} satisfies Meta<typeof AppStats>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    stats: {
      installs_per_day: {
        "2022-01-01": 1,
        "2022-01-02": 2,
        "2022-01-03": 3,
        "2022-01-04": 4,
        "2022-01-05": 5,
        "2022-01-06": 6,
        "2022-01-07": 7,
        "2022-01-08": 8,
        "2022-01-09": 9,
        "2022-01-10": 10,
      },
    },
  },
}
