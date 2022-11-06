import React from "react"
import { ComponentMeta } from "@storybook/react"
import AppVerificationDisclosure from "./AppVerificationDisclosure"

export default {
  title: "Components/Application/AppVerificationDisclosure",
  component: AppVerificationDisclosure,
} as ComponentMeta<typeof AppVerificationDisclosure>

export const Generated = () => {
  const verificationMethods = {
    methods: [
      {
        method: "website",
        website: "https://my.domain",
      },
      {
        method: "login_provider",
        login_provider: "GitHub",
        login_name: "my user name",
      },
    ],
  }

  return (
    <AppVerificationDisclosure
      appId={"my.domain.appId"}
      verificationMethods={verificationMethods}
    />
  )
}
