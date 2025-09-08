import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import PurchaseControls from "./PurchaseControls"
import { VendingConfig, VendingSetup } from "../../../codegen/model"

const meta = {
  component: PurchaseControls,
  title: "Components/Application/AppVendingControls/PurchaseControls",
} satisfies Meta<typeof PurchaseControls>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    app: {
      id: "org.flathub.arsenal",
      name: "Arsenal",
      bundle: {
        runtime: "org.freedesktop.Platform",
        sdk: "org.freedesktop.Sdk",
        value: "app/org.flathub.arsenal/org.freedesktop.Platform",
        type: "flatpak",
      },
    },
    vendingConfig: {
      fee_cost_percent: 5,
      fee_fixed_cost: 2,
      fee_prefer_percent: 2,
      platforms: {
        "org.freedesktop.Platform": { keep: 10, aliases: [] },
      },
      status: "ok",
    },
    amount: {
      live: 4,
      settled: 4,
    },
    setAmount: () => {},
    vendingSetup: {
      appshare: 50,
      currency: "usd",
      minimum_payment: 400,
      recommended_donation: 400,
    } as VendingSetup,
  },
}

export const UnderMinimum: Story = {
  args: {
    app: {
      id: "org.flathub.arsenal",
      name: "Arsenal",
      bundle: {
        runtime: "org.freedesktop.Platform",
        sdk: "org.freedesktop.Sdk",
        value: "app/org.flathub.arsenal/org.freedesktop.Platform",
        type: "flatpak",
      },
    },
    vendingConfig: {
      fee_cost_percent: 5,
      fee_fixed_cost: 2,
      fee_prefer_percent: 2,
      platforms: {
        "org.freedesktop.Platform": { keep: 10, aliases: [] },
      },
      status: "ok",
    } as VendingConfig,
    amount: {
      live: 1,
      settled: 1,
    },
    setAmount: () => {},
    vendingSetup: {
      appshare: 50,
      currency: "usd",
      minimum_payment: 4000,
      recommended_donation: 5000,
    } as VendingSetup,
  },
}
