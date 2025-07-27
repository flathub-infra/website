import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import DeleteButton from "./DeleteButton"

const meta: Meta<typeof DeleteButton> = {
  title: "Components/DeleteButton",
  component: DeleteButton,
}

export default meta
type Story = StoryObj<typeof DeleteButton>

export const Primary: Story = {
  args: {},
}
