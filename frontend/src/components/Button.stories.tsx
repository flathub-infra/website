import React from "react"
import { Meta } from "@storybook/react"
import { HiMiniPlus } from "react-icons/hi2"
import { Button } from "@/components/ui/button"

export default {
  title: "Components/Button",
  component: Button,
} as Meta<typeof Button>

export const Primary = () => {
  return (
    <div className="flex gap-6">
      <Button>Test</Button>
      <Button>
        <HiMiniPlus className="w-5 h-5" />
        New app
      </Button>
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
      <Button variant="secondary">
        <HiMiniPlus className="w-5 h-5" />
        New app
      </Button>
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
      <Button variant="destructive">
        <HiMiniPlus className="w-5 h-5" />
        New app
      </Button>
      <Button disabled variant="destructive">
        Disabled
      </Button>
    </div>
  )
}
