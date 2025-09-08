import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { DistroSetup } from "../distro-setup"

import Index from "../../pages/setup/index"

const meta = {
  component: Index,
  title: "pages/setup",
} satisfies Meta<typeof Index>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    instructions: [
      {
        introduction: "Test",
        logo: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
        name: "Kodi Distro",
        steps: [{ name: "Install", text: "Do it" }],
        translatedNameKey: "Kodi Distro",
      },
      {
        introduction: "Test",
        logo: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
        name: "Kodi2 Distro",
        steps: [{ name: "Install", text: "Do it" }],
        translatedNameKey: "Kodi2 Distro",
      },
      {
        introduction: "Test",
        logo: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
        name: "Kodi3 Distro",
        steps: [{ name: "Install", text: "Do it" }],
        translatedNameKey: "Kodi3 Distro",
      },
    ] as DistroSetup[],
    locale: "en",
  },
}
