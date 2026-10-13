import { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import DangerZoneControls from "./DangerZoneControls"
import { getGetUploadTokensUploadTokensAppIdGetMockHandler } from "../../codegen/upload-tokens/upload-tokens.msw"

const app = { id: "org.example.CriticalApp" }

const meta = {
  component: DangerZoneControls,
  title: "Components/Application/DangerZoneControls",
  args: { app },
  parameters: {
    layout: "padded",
    msw: {
      handlers: [
        getGetUploadTokensUploadTokensAppIdGetMockHandler({
          tokens: [],
          is_direct_upload_app: false,
          allowed_repos: [],
        }),
      ],
    },
  },
} satisfies Meta<typeof DangerZoneControls>

export default meta

type Story = StoryObj<typeof meta>

export const ArchiveConfirmation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      await canvas.findByRole("button", { name: "Archive this app" }),
    )

    const dialog = within(canvasElement.ownerDocument.body)
    await waitFor(() =>
      expect(
        dialog.getByText("Archiving affects this app and its publishers"),
      ).toBeInTheDocument(),
    )

    const confirmButton = dialog.getByRole("button", { name: "Archive" })
    const acknowledgement = dialog.getByRole("checkbox")
    expect(confirmButton).toBeDisabled()
    await userEvent.click(acknowledgement)
    expect(confirmButton).toBeEnabled()
  },
}

export const DirectUploadConfirmation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      await canvas.findByRole("button", {
        name: "Switch app to direct upload",
      }),
    )

    const dialog = within(canvasElement.ownerDocument.body)
    await waitFor(() =>
      expect(
        dialog.getByText("This change cannot be undone"),
      ).toBeInTheDocument(),
    )

    const confirmButton = dialog.getByRole("button", { name: "Confirm" })
    const acknowledgement = dialog.getByRole("checkbox")
    expect(confirmButton).toBeDisabled()
    await userEvent.click(acknowledgement)
    expect(confirmButton).toBeEnabled()
  },
}
