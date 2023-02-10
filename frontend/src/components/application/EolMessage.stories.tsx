import React from "react"
import { Meta } from "@storybook/react"
import EolMessage from "./EolMessage"
import { faker } from "@faker-js/faker"

export default {
  title: "Components/Application/EolMessage",
  component: EolMessage,
  argTypes: {
    message: {
      control: "text",
    },
  },
} as Meta<typeof EolMessage>

const Render = (args) => {
  return <EolMessage message={args.message} />
}

export const Example = Render.bind({})
Example.args = {
  message: faker.lorem.sentence(),
}
