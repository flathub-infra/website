import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { http, HttpResponse } from "msw"

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

export const SmoothNavigation: Story = {
  args: Default.args,
  parameters: {
    msw: {
      handlers: [
        http.get(
          /^https:\/\/(imgproxy\.flathub\.org|placehold\.co)\//,
          () =>
            new HttpResponse(
              '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#4a90d9" /></svg>',
              { headers: { "Content-Type": "image/svg+xml" } },
            ),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // A swipe needs loaded neighboring slides, not just the current image.
    await waitFor(() => {
      const images =
        canvasElement.querySelectorAll<HTMLImageElement>(".yarl__slide img")
      expect(images).toHaveLength(3)
      for (const image of images) {
        expect(image.complete && image.naturalWidth > 0).toBe(true)
      }
    })

    const outgoingSlide = canvasElement.querySelector(".yarl__slide_current")
    await userEvent.click(canvas.getByRole("button", { name: "Next" }))
    expect(outgoingSlide).toBeInTheDocument()
    await waitFor(() =>
      expect(
        canvasElement.querySelector(".yarl__slide_current img"),
      ).toHaveAttribute("alt", "Screenshot 2"),
    )
  },
}
