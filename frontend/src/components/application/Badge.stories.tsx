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

export const ChangedClassName = () => {
  return <Badge text={"Outdated"} inACard={true} />
}
