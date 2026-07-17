import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { UnverifiedAppDisclaimer } from "./UnverifiedAppDisclaimer"

const meta = {
  title: "Components/Application/UnverifiedAppDisclaimer",
  component: UnverifiedAppDisclaimer,
} satisfies Meta<typeof UnverifiedAppDisclaimer>

export default meta

type Story = StoryObj<typeof meta>

export const Package: Story = {
  args: {
    developerName: "VideoLAN et al.",
    isVerified: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(
      canvas.getByText(
        "This community-provided package is not verified by, affiliated with, or supported by VideoLAN et al.",
      ),
    ).toBeInTheDocument()
  },
}

export const UnknownDeveloper: Story = {
  args: {
    developerName: "   ",
    isVerified: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(
      canvas.getByText(
        "This community-provided package is not verified by, affiliated with, or supported by the app developer.",
      ),
    ).toBeInTheDocument()
  },
}

export const Verified: Story = {
  args: {
    developerName: "Mozilla",
    isVerified: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(
      canvas.queryByText(
        "This community-provided package is not verified by, affiliated with, or supported by Mozilla.",
      ),
    ).not.toBeInTheDocument()
  },
}
