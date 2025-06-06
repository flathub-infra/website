import type { Meta, StoryObj } from "@storybook/nextjs"

import { Description } from "./Description"
import { faker } from "@faker-js/faker"

const meta = {
  component: Description,
  title: "Components/Application/Description",
} satisfies Meta<typeof Description>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    app: {
      description: faker.lorem.paragraphs(10),
      summary: "This is a summary, that's way too long",
    },
    isQualityModalOpen: false,
  },
}

export const QualityModalOpen: Story = {
  args: {
    app: {
      description: faker.lorem.paragraphs(3),
      summary: "This is a summary, that's way too long",
    },
    isQualityModalOpen: true,
  },
}
