import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import PublisherAgreement from "./PublisherAgreement"
import { UserState } from "../../types/Login"
import { Permission } from "../../codegen/model"
import { UserContext } from "../../context/user-info"
import { expect, within } from "storybook/test"

const meta = {
  component: PublisherAgreement,
  title: "Components/User/PublisherAgreement",
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
} satisfies Meta<typeof PublisherAgreement>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onAccept: () => {},
    onCancel: () => {},
    continueText: "Continue",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(canvas.getByRole("button", { name: "Continue" })).toBeInTheDocument()
    expect(canvas.getByRole("button", { name: "Cancel" })).toBeInTheDocument()
    expect(
      canvas.getByRole("checkbox", {
        name: "I accept the Publisher Submission Agreement",
      }),
    ).toBeInTheDocument()
    expect(
      canvas.getByText("Publisher Submission Agreement"),
    ).toBeInTheDocument()
    expect(canvas.getByText("Definitions.")).toBeInTheDocument()
  },
  render: function Render(args) {
    const userInfo: UserState = {
      loading: false,
      info: {
        permissions: [Permission.moderation],
      },
    }
    return (
      <UserContext value={{ ...userInfo }}>
        <PublisherAgreement {...args} />
      </UserContext>
    )
  },
}
