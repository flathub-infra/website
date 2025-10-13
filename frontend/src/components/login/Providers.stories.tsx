import { Meta } from "@storybook/nextjs-vite"
import Providers from "./Providers"
import { LoginMethod } from "../../codegen"

export default {
  title: "Components/Login/Providers",
  component: Providers,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
} as Meta<typeof Providers>

export const generated = () => {
  const providers: LoginMethod[] = [
    {
      method: "github",
      name: "GitHub",
    },
    {
      method: "gitlab",
      name: "GitLab",
    },
    {
      method: "gnome",
      name: "GNOME",
    },
    {
      method: "google",
      name: "Google",
    },
  ]

  return <Providers providers={providers} />
}
