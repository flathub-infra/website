import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import InstallFallback from "./InstallFallback"

const meta = {
  component: InstallFallback,
} satisfies Meta<typeof InstallFallback>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    app: {
      id: "tv.abc.TestApp",
      name: "Test App",
      icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
    },
  },
}
