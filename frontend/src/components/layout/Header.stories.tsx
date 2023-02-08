import React from "react"
import { Meta } from "@storybook/react"
import Header from "./Header"

export default {
  title: "Components/Layout/Header",
  component: Header,
} as Meta<typeof Header>

export const Generated = () => {
  return <Header />
}
