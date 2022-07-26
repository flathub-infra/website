import React from "react"
import { ComponentMeta } from "@storybook/react"
import Spinner from "./Spinner"

export default {
  title: "Components/Spinner",
  component: Spinner,
} as ComponentMeta<typeof Spinner>

export const S = () => {
  return <Spinner size="s" text="Loading text..."></Spinner>
}

export const M = () => {
  return <Spinner size="m" text="Loading text..."></Spinner>
}

export const L = () => {
  return <Spinner size="l" text="Loading text..."></Spinner>
}
