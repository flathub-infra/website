import { Meta } from "@storybook/react"
import React from "react"
import { Notice } from "./Notice"

export default {
  title: "Components/Notice",
  component: Notice,
} as Meta<typeof Notice>

export const info = () => {
  return <Notice>For your information</Notice>
}

export const danger = () => {
  return <Notice variant="danger">Here be dragons!</Notice>
}
