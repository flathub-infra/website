import React from "react"
import { Meta } from "@storybook/nextjs-vite"
import ListBox from "./ListBox"
import { faker } from "@faker-js/faker"
import { CodeBracketIcon } from "@heroicons/react/24/solid"

export default {
  title: "Components/Application/ListBox",
  component: ListBox,
} as Meta<typeof ListBox>

export const singleText = () => {
  const items = [
    {
      icon: <CodeBracketIcon className="size-6" />,
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
      icon: <CodeBracketIcon className="size-6" />,
      header: faker.commerce.product(),
      content: {
        type: "text" as const,
        text: faker.commerce.productDescription(),
      },
    },
    {
      icon: <CodeBracketIcon className="size-6" />,
      header: faker.commerce.product(),
      content: {
        type: "text" as const,
        text: faker.commerce.productDescription(),
      },
    },
    {
      icon: <CodeBracketIcon className="size-6" />,
      header: faker.commerce.product(),
      content: {
        type: "text" as const,
        text: faker.commerce.productDescription(),
      },
    },
  ]

  return <ListBox items={items} />
}
