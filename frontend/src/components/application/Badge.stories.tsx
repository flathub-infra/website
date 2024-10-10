import React from "react"
import { Meta } from "@storybook/react"
import Badge from "./Badge"

export default {
  title: "Components/Application/Badge",
  component: Badge,
} as Meta<typeof Badge>

export const TextOnly = () => {
  return <Badge text={"Outdated"} />
}

export const InACard = () => {
  return (
    <div className="rounded-xl bg-flathub-white p-4 pt-3 shadow-md dark:bg-flathub-arsenic">
      <Badge text={"Outdated"} inACard={true} />
    </div>
  )
}
