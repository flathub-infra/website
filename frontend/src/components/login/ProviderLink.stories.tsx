import React from "react"
import { Meta } from "@storybook/nextjs-vite"
import ProviderLink from "./ProviderLink"
import { LoginMethod } from "../../codegen"

export default {
  title: "Components/Login/ProviderLink",
  component: ProviderLink,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
} as Meta<typeof ProviderLink>

export const github = () => {
  const provider: LoginMethod = {
    method: "github",
    name: "GitHub",
  }

  return <ProviderLink provider={provider} />
}

export const gitlab = () => {
  const provider: LoginMethod = {
    method: "gitlab",
    name: "GitLab",
  }

  return <ProviderLink provider={provider} />
}

export const gnome = () => {
  const provider: LoginMethod = {
    method: "gnome",
    name: "GNOME",
  }

  return <ProviderLink provider={provider} />
}

export const google = () => {
  const provider: LoginMethod = {
    method: "google",
    name: "Google",
  }

  return <ProviderLink provider={provider} />
}
