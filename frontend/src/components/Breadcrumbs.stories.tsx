import React from "react"
import { Meta } from "@storybook/react"
import Breadcrumbs from "./Breadcrumbs"
import { useTranslations } from "next-intl"

export default {
  title: "Components/Breadcrumbs",
  component: Breadcrumbs,
} as Meta<typeof Breadcrumbs>

export const Generated = () => {
  const t = useTranslations()

  const pages = [
    { name: t("user-wallet"), href: "/wallet", current: false },
    {
      name: t("transaction-summary"),
      href: "/payment/details/12",
      current: true,
    },
  ]

  return <Breadcrumbs pages={pages} />
}
