import React from "react"
import { Meta } from "@storybook/react"
import VendingSharesPreview from "./VendingSharesPreview"

export default {
  title: "Components/Application/VendingSharesPreview",
  component: VendingSharesPreview,
} as Meta<typeof VendingSharesPreview>

export const Generated = () => {
  return (
    <VendingSharesPreview
      price={400}
      appShare={50}
      app={{
        id: "org.flathub.arsenal",
        name: "Arsenal",
        bundle: {
          runtime: "org.freedesktop.Gnome",
        },
      }}
      vendingConfig={{
        fee_cost_percent: 5,
        fee_fixed_cost: 2,
        fee_prefer_percent: 2,
        platforms: { "org.freedesktop.Gnome": { keep: 100, aliases: [] } },
        status: "ok",
      }}
    />
  )
}
