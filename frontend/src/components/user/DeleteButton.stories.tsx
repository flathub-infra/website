import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import DeleteButton from "./DeleteButton"
import { UserInfoProvider } from "../../context/user-info"

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, refetchOnMount: false } },
})

const meta: Meta<typeof DeleteButton> = {
  title: "Components/User/DeleteButton",
  component: DeleteButton,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <UserInfoProvider>
          <Story />
        </UserInfoProvider>
      </QueryClientProvider>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof DeleteButton>

export const Primary: Story = {}
