import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import Bannerpreview from "../../pages/apps/[appId]/bannerpreview"

const meta = {
  component: Bannerpreview,
  title: "pages/bannerpreview",
} satisfies Meta<typeof Bannerpreview>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    eolMessage: "",
    app: { id: "tv.kodi.Kodi", name: "Kodi" },
    heroBannerData: [
      {
        app: { app_id: "tv.kodi.Kodi", isFullscreen: false, position: 1 },
        appstream: {
          id: "tv.kodi.Kodi",
          name: "Kodi",
          summary: "Best TV Experiance",
          icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
          screenshots: [
            {
              caption: "Screenshot 1",
              sizes: [
                {
                  src: "https://placehold.co/600x400",
                  width: "600",
                  height: "400",
                  scale: "1x",
                },
                {
                  src: "https://placehold.co/800x600",
                  width: "800",
                  height: "600",
                  scale: "2x",
                },
              ],
            },
          ],
          branding: [
            { scheme_preference: "light", value: "#880000", type: "primary" },
            { scheme_preference: "dark", value: "#440000", type: "primary" },
          ],
        },
      },
    ],
  },
}

export const BannerpreviewEOL: Story = {
  args: {
    app: { id: "tv.kodi.Kodi", name: "Kodi" },
    eolMessage: "Unfortunatly EOLed",
    heroBannerData: [],
  },
}
