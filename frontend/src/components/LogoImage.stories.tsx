import type { Meta, StoryObj } from "@storybook/nextjs-vite"

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

export const Small: Story = {
  args: {
    appName: "Kodi",
    iconUrl:
      "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
    size: "24",
  },
}

export const Medium: Story = {
  args: {
    appName: "Kodi",
    iconUrl:
      "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
    size: "64",
  },
}

export const Large: Story = {
  args: {
    appName: "Kodi",
    iconUrl:
      "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
    size: "256",
  },
}

export const Fallback: Story = {
  args: {
    appName: "Kodi",
    iconUrl: "",
    size: "128",
  },
}

export const ExternalUrl: Story = {
  args: {
    appName: "Kodi",
    iconUrl: "https://example.com/icon.png",
    size: "128",
  },
}
