import React from "react"
import { ComponentMeta } from "@storybook/react"
import Breadcrumbs from "./Breadcrumbs"

export default {
  title: "Components/Breadcrumbs",
  component: Breadcrumbs,
} as ComponentMeta<typeof Breadcrumbs>

export const Generated = () => {
  const pages = [
    { name: "user-wallet", href: "/wallet", current: false },
    { name: "payment-summary", href: "/payment/details/12", current: true },
  ]

  return <Breadcrumbs pages={pages} />
}
