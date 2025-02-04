import { Meta, StoryObj } from "@storybook/react"
import { faker } from "@faker-js/faker"
import WebsiteVerification from "./WebsiteVerification"
import { expect, userEvent, waitFor, within } from "@storybook/test"

const meta = {
  component: WebsiteVerification,
  title: "Components/Application/AppVerificationControls/WebsiteVerification",
} satisfies Meta<typeof WebsiteVerification>

export default meta

type Story = StoryObj<typeof meta>

export const NoTokenFirstStep: Story = {
  args: {
    appId: "io.github.appId",
    isNewApp: false,
    method: {
      method: "website",
      website: faker.internet.url(),
    },
    onVerified: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole("button", { name: "Website verification" }),
    )

    await waitFor(() => {
      expect(canvas.getByText("io.github.appId")).toBeInTheDocument()
      expect(canvas.getByText("Begin")).toBeInTheDocument()
    })
  },
}

export const HasTokenSecondStep: Story = {
  args: {
    appId: "io.github.appId",
    isNewApp: false,
    method: {
      method: "website",
      website: "test.com/my-app",
      website_token: faker.string.uuid(),
    },
    onVerified: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole("button", { name: "Website verification" }),
    )

    await waitFor(() => {
      expect(
        canvas.getByText(
          "https://test.com/my-app/.well-known/org.flathub.VerifiedApps.txt",
        ),
      ).toBeInTheDocument()
      expect(canvas.getByText("Continue")).toBeInTheDocument()
    })
  },
}
