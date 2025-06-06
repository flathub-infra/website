import type { Meta, StoryObj } from "@storybook/nextjs"

import { StackedListBox } from "./StackedListBox"
import { HiCodeBracket } from "react-icons/hi2"
import React from "react"
import { faker } from "@faker-js/faker"

const meta = {
  component: StackedListBox,
  title: "Components/Application/StackedListBox",
} satisfies Meta<typeof StackedListBox>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    items: [
      {
        id: 1,
        header: faker.lorem.words(3),
        description: faker.lorem.text(),
        icon: <HiCodeBracket />,
      },
      {
        id: 2,
        header: faker.lorem.words(3),
        description: faker.lorem.text(),
        icon: <HiCodeBracket />,
      },
      {
        id: 3,
        header: faker.lorem.words(3),
        description: faker.lorem.text(),
      },
      {
        id: 4,
        header: faker.lorem.words(3),
        description: faker.lorem.text(),
        icon: <HiCodeBracket />,
      },
    ],
  },
}
