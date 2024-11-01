import type { Meta, StoryObj } from "@storybook/react"

import PurchaseControls from "./PurchaseControls"
import { getVendingMock } from "../../../codegen/vending/vending.msw"
import { VendingSetup } from "../../../codegen/model"

const meta = {
  component: PurchaseControls,
  title: "Components/Application/AppVendingControls/PurchaseControls",
} satisfies Meta<typeof PurchaseControls>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  parameters: {
    msw: {
      handlers: [...getVendingMock()],
    },
  },
  args: {
    app: {
      id: "org.flathub.arsenal",
      name: "Arsenal",
      bundle: {
        runtime: "org.freedesktop.Gnome",
        sdk: "org.freedesktop.Sdk",
        value: "app/org.flathub.arsenal/org.freedesktop.Gnome",
        type: "flatpak",
      },
    },
    vendingConfig: {
      fee_cost_percent: 5,
      fee_fixed_cost: 2,
      fee_prefer_percent: 2,
      platforms: { "org.freedesktop.Gnome": { keep: 100, aliases: [] } },
      status: "ok",
    },
    amount: {
      live: 0,
      settled: 0,
    },
    setAmount: () => {},
    vendingSetup: {
      appshare: 50,
      currency: "usd",
      minimum_payment: 0,
      recommended_donation: 0,
    } as VendingSetup,
  },
}
