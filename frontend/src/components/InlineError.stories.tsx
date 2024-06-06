import React from "react"
import { Meta } from "@storybook/react"
import InlineError from "./InlineError"

export default {
  title: "Components/InlineError",
  component: InlineError,
} as Meta<typeof InlineError>

export const Primary = () => {
  return (
    <InlineError shown={true} error="Failed to process request"></InlineError>
  )
}
