import React from "react"
import { ComponentMeta } from "@storybook/react"
import Header from "./Header"

export default {
  title: "Components/Layout/Header",
  component: Header,
} as ComponentMeta<typeof Header>

export const Generated = () => {
  return <Header />
}
