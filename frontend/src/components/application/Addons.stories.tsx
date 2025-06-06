import type { Meta, StoryObj } from "@storybook/nextjs"

import Addons from "./Addons"
import { faker } from "@faker-js/faker"

const meta = {
  component: Addons,
  title: "Components/Application/Addons",
} satisfies Meta<typeof Addons>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    addons: [
      {
        id: "tv.abc.TestAddon",
        name: faker.lorem.words(),
        summary: faker.lorem.text(),
      },
      {
        id: "tv.abc.TestAddon2",
        name: faker.lorem.words(),
        summary: faker.lorem.text(),
      },
      {
        id: "tv.abc.TestAddon3",
        name: faker.lorem.words(),
        summary: faker.lorem.text(),
      },
    ],
  },
}
