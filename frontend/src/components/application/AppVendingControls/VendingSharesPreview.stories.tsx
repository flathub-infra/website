import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import VendingSharesPreview from "./VendingSharesPreview"
import { useArgs } from "storybook/internal/preview-api"

const meta = {
  component: VendingSharesPreview,
  title: "Components/Application/AppVendingControls/VendingSharesPreview",
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
} satisfies Meta<typeof VendingSharesPreview>

export default meta

type Story = StoryObj<typeof meta>

export const DefaultNonInteractive: Story = {
  args: {
    price: 400,
    appShare: 50,
    setAppShare: (share: number) => {},
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

export const DefaultInteractive: Story = {
  render: function Render(args) {
    const [{ appShare }, updateArgs] = useArgs()

    function onChange(share: number) {
      updateArgs({ appShare: share })
    }

    return (
      <VendingSharesPreview
        {...args}
        appShare={appShare}
        setAppShare={onChange}
      />
    )
  },
  args: {
    price: 400,
    appShare: 50,
    setAppShare: (share: number) => {},
    interactive: true,
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
