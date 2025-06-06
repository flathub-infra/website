import type { Meta, StoryObj } from "@storybook/nextjs"

import LogoImage from "./LogoImage"

const meta = {
  title: "Components/LogoImage",
  component: LogoImage,
} satisfies Meta<typeof LogoImage>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    appName: "Kodi",
    iconUrl:
      "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
    size: "128",
  },
}
