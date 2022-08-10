import React from "react"
import { ComponentMeta } from "@storybook/react"
import ProviderLink from "./ProviderLink"
import { LoginProvider } from "../../types/Login"

export default {
  title: "Components/Login/ProviderLink",
  component: ProviderLink,
} as ComponentMeta<typeof ProviderLink>

export const github = () => {
  const provider: LoginProvider = {
    method: "github",
    name: "GitHub",
  }

  return <ProviderLink provider={provider} />
}

export const gitlab = () => {
  const provider: LoginProvider = {
    method: "gitlab",
    name: "GitLab",
  }

  return <ProviderLink provider={provider} />
}

export const gnome = () => {
  const provider: LoginProvider = {
    method: "gnome",
    name: "GNOME",
  }

  return <ProviderLink provider={provider} />
}

export const google = () => {
  const provider: LoginProvider = {
    method: "google",
    name: "Google",
  }

  return <ProviderLink provider={provider} />
}
