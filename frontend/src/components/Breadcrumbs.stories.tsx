import React from "react"
import { Meta } from "@storybook/nextjs"
import Breadcrumbs from "./Breadcrumbs"
import { useTranslation } from "next-i18next"

export default {
  title: "Components/Breadcrumbs",
  component: Breadcrumbs,
} as Meta<typeof Breadcrumbs>

export const Generated = () => {
  const { t } = useTranslation()

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
