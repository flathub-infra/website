import React from "react"
import { Meta } from "@storybook/react"
import Button from "./Button"

export default {
  title: "Components/Button",
  component: Button,
} as Meta<typeof Button>

export const Primary = () => {
  return (
    <div className="flex gap-6">
      <Button>Test</Button>
      <Button disabled variant="primary">
        Disabled
      </Button>
    </div>
  )
}

export const Secondary = () => {
  return (
    <div className="flex gap-6">
      <Button variant="secondary">Test</Button>
      <Button disabled variant="secondary">
        Disabled
      </Button>
    </div>
  )
}

export const Destructive = () => {
  return (
    <div className="flex gap-6">
      <Button variant="destructive">Test</Button>
      <Button disabled variant="destructive">
        Disabled
      </Button>
    </div>
  )
}
