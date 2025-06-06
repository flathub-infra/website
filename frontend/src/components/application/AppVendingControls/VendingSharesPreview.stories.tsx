import type { Meta, StoryObj } from "@storybook/nextjs"

import VendingSharesPreview from "./VendingSharesPreview"

const meta = {
  component: VendingSharesPreview,
  title: "Components/Application/AppVendingControls/VendingSharesPreview",
} satisfies Meta<typeof VendingSharesPreview>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    price: 400,
    appShare: 50,
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
  },
}
