import React from "react"
import { Meta, StoryObj } from "@storybook/nextjs-vite"
import VerificationIcon from "./VerificationIcon"
import { expect, userEvent, within } from "storybook/test"
import {
  VerificationStatusLoginProvider,
  VerificationStatusDns,
  VerificationStatusManual,
  VerificationStatusWebsite,
} from "src/codegen"
const meta = {
  title: "Components/Application/VerificationIcon",
  component: VerificationIcon,
} satisfies Meta<typeof VerificationIcon>

export default meta

type Story = StoryObj<typeof meta>

export const manualVerification = () => {
  const verificationStatus: VerificationStatusManual = {
    verified: true,
    timestamp: "1678175850",
    detail: "",
    method: "manual",
  }
  return (
    <VerificationIcon
      appId="org.flathub.Example"
      verificationStatus={verificationStatus}
    />
  )
}
export const websiteVerification = () => {
  const verificationStatus: VerificationStatusWebsite = {
    verified: true,
    timestamp: "1678175850",
    detail: "",
    method: "website",
    website: "https://example.com",
  }
  return (
    <VerificationIcon
      appId="com.example.Example"
      verificationStatus={verificationStatus}
    />
  )
}
export const dnsVerification: Story = {
  args: {
    appId: "com.example.Example",
    verificationStatus: {
      verified: true,
      timestamp: "1678175850",
      detail: "",
      method: "dns",
      website: "example.com",
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.hover(
      canvas.getByRole("button", { name: "This app is verified" }),
    )

    const body = within(canvasElement.ownerDocument.body)
    expect(await body.findByRole("tooltip")).toHaveTextContent(
      "The ownership of the com.example.Example app ID has been verified through DNS control of example.com",
    )
  },
}

export const loginProviderVerification = () => {
  const verificationStatus: VerificationStatusLoginProvider = {
    verified: true,
    timestamp: "1678175850",
    login_name: "user_name",
    method: "login_provider",
    login_provider: "github",
    detail: "",
  }
  return (
    <VerificationIcon
      appId="io.github.Example"
      verificationStatus={verificationStatus}
    />
  )
}
