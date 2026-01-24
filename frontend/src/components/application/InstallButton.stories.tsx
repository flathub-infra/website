import { Meta, StoryObj } from "@storybook/nextjs-vite"
import InstallButton from "./InstallButton"
import { userEvent, within } from "storybook/internal/test"

const meta = {
  title: "Components/InstallButton",
  component: InstallButton,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
} satisfies Meta<typeof InstallButton>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    (Story) => (
      <div className="flex">
        <div className="ms-auto">
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    appId: "tv.abc.TestApp",
  },
}

export const OpenDefault: Story = {
  decorators: [
    (Story) => (
      <div className="flex">
        <div className="ms-auto">
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    appId: "tv.abc.TestApp",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const button = canvas.getAllByRole("button")

    await userEvent.click(button[1])
  },
}

export const Addon: Story = {
  decorators: [
    (Story) => (
      <div className="flex">
        <div className="ms-auto">
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    appId: "tv.abc.TestApp",
    type: "addon",
  },
}

export const OpenAddon: Story = {
  decorators: [
    (Story) => (
      <div className="flex">
        <div className="ms-auto">
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    appId: "tv.abc.TestApp",
    type: "addon",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const button = canvas.getByText("Install")

    await userEvent.click(button)
  },
}
