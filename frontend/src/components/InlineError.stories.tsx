import React from "react"
import { ComponentMeta } from "@storybook/react"
import InlineError from "./InlineError"

export default {
  title: "Components/InlineError",
  component: InlineError,
} as ComponentMeta<typeof InlineError>

export const Primary = () => {
  return (
    <InlineError shown={true} error="Failed to process request"></InlineError>
  )
}
