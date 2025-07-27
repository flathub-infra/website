import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { AppOfTheDay } from "./AppOfTheDay"

const meta = {
  component: AppOfTheDay,
  title: "Components/Application/AppOfTheDay",
} satisfies Meta<typeof AppOfTheDay>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    appOfTheDay: {
      name: "Kodi",
      icon: "https://flathub.org/_next/image?url=https%3A%2F%2Fdl.flathub.org%2Fmedia%2Ftv%2Fkodi%2FKodi%2Fdd163a745edd525dcfeaeee92663d697%2Ficons%2F128x128%2Ftv.kodi.Kodi.png&w=128&q=100",
      id: "tv.kodi.Kodi",
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
      summary: "Ultimate entertainment center",
    },
  },
}
