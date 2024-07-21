import { ApplicationCard } from "./ApplicationCard"
import { faker } from "@faker-js/faker"

import type { Meta, StoryObj } from "@storybook/react"

const meta: Meta<typeof ApplicationCard> = {
  component: ApplicationCard,
}

export default meta
type Story = StoryObj<typeof ApplicationCard>

export const Primary: Story = {
  args: {
    application: {
      id: faker.datatype.uuid(),
      icon: faker.image.image(),
      name: faker.commerce.product(),
      summary: faker.commerce.productDescription(),
    },
  },
}

export const inACard: Story = {
  args: {
    application: {
      id: faker.datatype.uuid(),
      icon: faker.image.image(),
      name: faker.commerce.product(),
      summary: faker.commerce.productDescription(),
    },
    inACard: true,
  },
}
