import { Meta } from "@storybook/nextjs-vite"
import Header from "./Header"

export default {
  title: "Components/Layout/Header",
  component: Header,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
} as Meta<typeof Header>

export const Generated = () => {
  return <Header />
}
