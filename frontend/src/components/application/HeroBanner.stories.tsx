import type { Meta, StoryObj } from "@storybook/nextjs"

import { HeroBanner } from "./HeroBanner"

const meta = {
  component: HeroBanner,
  title: "Components/Application/HeroBanner",
} satisfies Meta<typeof HeroBanner>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    heroBannerData: [
      {
        app: {
          isFullscreen: false,
        },
        appstream: {
          id: "tv.kodi.Kodi",
          name: "Kodi",
          summary: "Ultimate entertainment center",
          branding: [
            {
              scheme_preference: "light",
              type: "primary",
              value: "#E8F8FF",
            },
            {
              scheme_preference: "dark",
              type: "primary",
              value: "#082838",
            },
          ],
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
            {
              caption: "Screenshot 2",
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
            {
              caption: "Screenshot 3",
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
          icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
        },
      },
    ],
  },
}

export const Fullscreen: Story = {
  args: {
    heroBannerData: [
      {
        app: {
          isFullscreen: true,
        },
        appstream: {
          id: "tv.kodi.Kodi",
          name: "Kodi",
          summary: "Ultimate entertainment center",
          branding: [
            {
              scheme_preference: "light",
              type: "primary",
              value: "#E8F8FF",
            },
            {
              scheme_preference: "dark",
              type: "primary",
              value: "#082838",
            },
          ],
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
            {
              caption: "Screenshot 2",
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
            {
              caption: "Screenshot 3",
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
          icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
        },
      },
    ],
  },
}
