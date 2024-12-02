import type { Meta, StoryObj } from "@storybook/react"

import AdditionalInfo from "./AdditionalInfo"
import { faker } from "@faker-js/faker"

const meta = {
  component: AdditionalInfo,
  title: "Components/Application/AdditionalInfo",
} satisfies Meta<typeof AdditionalInfo>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    stats: {
      installs_total: faker.number.int(),
    },
    summary: {
      installed_size: faker.number.int(),
      download_size: faker.number.int(),
      arches: ["amd64"],
    },
  },
}
