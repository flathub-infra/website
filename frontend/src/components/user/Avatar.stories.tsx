import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import Avatar from "./Avatar"

const meta: Meta<typeof Avatar> = {
  title: "Components/Avatar",
  component: Avatar,
}

export default meta
type Story = StoryObj<typeof Avatar>

export const Fallback: Story = {
  args: {
    avatarUrl: null,
    userName: "User Name",
  },
}

export const NormalAvatar: Story = {
  args: {
    avatarUrl: "https://avatars.githubusercontent.com/u/5943908?s=400&v=4",
    userName: "User Name",
  },
}
