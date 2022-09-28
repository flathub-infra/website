import React from "react"
import { ComponentMeta } from "@storybook/react"
import Button from "./Button"

export default {
  title: "Components/Button",
  component: Button,
} as ComponentMeta<typeof Button>

export const Primary = () => {
  return <Button>Test</Button>
}

export const Secondary = () => {
  return <Button variant="secondary">Test</Button>
}

export const Destructive = () => {
  return <Button variant="destructive">Test</Button>
}

export const Disabled = () => {
  return (
    <Button disabled variant="primary">
      Test
    </Button>
  )
}
