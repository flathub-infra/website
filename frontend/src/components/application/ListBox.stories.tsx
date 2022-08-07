import React from "react"
import { ComponentMeta } from "@storybook/react"
import ListBox from "./ListBox"
import { faker } from "@faker-js/faker"
import { MdCode } from "react-icons/md"

export default {
  title: "Components/Application/ListBox",
  component: ListBox,
} as ComponentMeta<typeof ListBox>

export const singleLink = () => {
  const items = [
    {
      icon: <MdCode />,
      header: faker.commerce.product(),
      content: {
        type: "url",
        text: faker.commerce.productDescription(),
        trackAsEvent: "url",
      },
    },
  ]

  return <ListBox items={items} />
}

export const singleText = () => {
  const items = [
    {
      icon: <MdCode />,
      header: faker.commerce.product(),
      content: {
        type: "text",
        text: faker.commerce.productDescription(),
      },
    },
  ]

  return <ListBox items={items} />
}

export const stacked = () => {
  const items = [
    {
      icon: <MdCode />,
      header: faker.commerce.product(),
      content: {
        type: "url",
        text: faker.commerce.productDescription(),
        trackAsEvent: "url",
      },
    },
    {
      icon: <MdCode />,
      header: faker.commerce.product(),
      content: {
        type: "text",
        text: faker.commerce.productDescription(),
      },
    },
    {
      icon: <MdCode />,
      header: faker.commerce.product(),
      content: {
        type: "url",
        text: faker.commerce.productDescription(),
        trackAsEvent: "url",
      },
    },
  ]

  return <ListBox items={items} />
}
