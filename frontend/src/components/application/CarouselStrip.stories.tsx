import type { Meta, StoryObj } from "@storybook/nextjs"

import { CarouselStrip } from "./CarouselStrip"

const meta = {
  component: CarouselStrip,
  title: "Components/Application/CarouselStrip",
} satisfies Meta<typeof CarouselStrip>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    app: {
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
    },
  },
}
