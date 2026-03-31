import { Meta } from "@storybook/nextjs-vite"
import Header from "./Header"
import { UserInfoProvider } from "../../context/user-info"
import { getGetUserinfoAuthUserinfoGetMockHandler } from "../../codegen/auth/auth.msw"

export default {
  title: "Components/Layout/Header",
  component: Header,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
    msw: {
      handlers: [getGetUserinfoAuthUserinfoGetMockHandler()],
    },
  },
  decorators: [
    (Story) => (
      <UserInfoProvider>
        <Story />
      </UserInfoProvider>
    ),
  ],
} as Meta<typeof Header>

export const Generated = () => {
  return <Header />
}
