import React from "react"
import { Meta } from "@storybook/react"
import ListBox from "./ListBox"
import { faker } from "@faker-js/faker"
import { HiCodeBracket } from "react-icons/hi2"

export default {
  title: "Components/Application/ListBox",
  component: ListBox,
} as Meta<typeof ListBox>

export const singleText = () => {
  const items = [
    {
      icon: <HiCodeBracket />,
      header: faker.commerce.product(),
      content: {
        type: "text" as const,
        text: faker.commerce.productDescription(),
      },
    },
  ]

  return <ListBox items={items} />
}

export const stacked = () => {
  const items = [
    {
      icon: <HiCodeBracket />,
      header: faker.commerce.product(),
      content: {
        type: "text" as const,
        text: faker.commerce.productDescription(),
      },
    },
    {
      icon: <HiCodeBracket />,
      header: faker.commerce.product(),
      content: {
        type: "text" as const,
        text: faker.commerce.productDescription(),
      },
    },
    {
      icon: <HiCodeBracket />,
      header: faker.commerce.product(),
      content: {
        type: "text" as const,
        text: faker.commerce.productDescription(),
      },
    },
  ]

  return <ListBox items={items} />
}
