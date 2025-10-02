import React from "react"
import { Meta } from "@storybook/nextjs-vite"
import { PlusIcon } from "@heroicons/react/20/solid"
import { Button } from "@/components/ui/button"

export default {
  title: "Components/Button",
  component: Button,
} as Meta<typeof Button>

const ButtonRow = ({ variant = "default", size = "default" }) => {
  return (
    <div className="flex gap-6">
      <Button size={size} variant={variant}>
        Test
      </Button>
      <Button size={size} variant={variant}>
        <PlusIcon className="size-5" />
        New app
      </Button>
      <Button size={size} disabled variant={variant}>
        Disabled
      </Button>
    </div>
  )
}

export const Primary = () => {
  return (
    <div className="flex gap-6 flex-col">
      <ButtonRow size="sm" />
      <ButtonRow />
      <ButtonRow size="lg" />
      <ButtonRow size="xl" />
    </div>
  )
}

export const Secondary = () => {
  return (
    <div className="flex gap-6 flex-col">
      <ButtonRow size="sm" variant="secondary" />
      <ButtonRow variant="secondary" />
      <ButtonRow size="lg" variant="secondary" />
      <ButtonRow size="xl" variant="secondary" />
    </div>
  )
}

export const Destructive = () => {
  return (
    <div className="flex gap-6 flex-col">
      <ButtonRow size="sm" variant="destructive" />
      <ButtonRow variant="destructive" />
      <ButtonRow size="lg" variant="destructive" />
      <ButtonRow size="xl" variant="destructive" />
    </div>
  )
}
