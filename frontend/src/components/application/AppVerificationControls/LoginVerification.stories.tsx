import { faker } from "@faker-js/faker"
import { Meta, StoryObj } from "@storybook/nextjs-vite"
import LoginVerification from "./LoginVerification"
import { expect, userEvent, waitFor, within } from "storybook/test"

const meta = {
  component: LoginVerification,
  title: "Components/Application/AppVerificationControls/LoginVerification",
} satisfies Meta<typeof LoginVerification>

export default meta

type Story = StoryObj<typeof meta>

export const Individual: Story = {
  args: {
    appId: "io.github.appId",
    isNewApp: false,
    method: {
      method: "login_provider",
      login_provider: "github",
      login_name: faker.internet.displayName(),
      login_is_organization: false,
      login_status: "ready",
    },
    onVerified: () => {},
    onReloadNeeded: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole("button", { name: "Login provider verification" }),
    )

    await waitFor(() => {
      expect(canvas.getByText("io.github.appId")).toBeInTheDocument()
      expect(canvas.getByText("Verify app")).toBeInTheDocument()
    })
  },
}

export const Organization: Story = {
  args: {
    appId: "io.github.appId",
    isNewApp: false,
    method: {
      method: "login_provider",
      login_provider: "github",
      login_name: faker.internet.domainWord(),
      login_is_organization: true,
      login_status: "ready",
    },
    onVerified: () => {},
    onReloadNeeded: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole("button", { name: "Login provider verification" }),
    )

    await waitFor(() => {
      expect(canvas.getByText("Verify app")).toBeInTheDocument()
      expect(canvas.getByText("io.github.appId")).toBeInTheDocument()
    })
  },
}
