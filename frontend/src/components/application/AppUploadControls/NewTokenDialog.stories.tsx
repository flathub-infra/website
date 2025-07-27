import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import NewTokenDialog from "./NewTokenDialog"

const meta = {
  title: "Components/Application/AppUploadControls/NewTokenDialog",
  component: NewTokenDialog,
} satisfies Meta<typeof NewTokenDialog>

export default meta

type Story = StoryObj<typeof meta>

export const DefaultBeta: Story = {
  args: {
    visible: true,
    app_id: "tv.kodi.Kodi",
    repo: "beta",
    cancel: () => {},
    created: () => {},
  },
}

export const DefaultStable: Story = {
  args: {
    visible: true,
    app_id: "tv.kodi.Kodi",
    repo: "stable",
    cancel: () => {},
    created: () => {},
  },
}
