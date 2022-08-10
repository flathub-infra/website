import React from "react"
import { ComponentMeta } from "@storybook/react"
import Providers from "./Providers"
import { LoginProvider } from "../../types/Login"

export default {
  title: "Components/Login/Providers",
  component: Providers,
} as ComponentMeta<typeof Providers>

export const generated = () => {
  const providers: LoginProvider[] = [
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
