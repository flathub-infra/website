import React from "react"
import { Meta } from "@storybook/react"
import VerificationIcon from "./VerificationIcon"
import { VerificationStatus } from "../../codegen"

export default {
  title: "Components/Application/VerificationIcon",
  component: VerificationIcon,
} as Meta<typeof VerificationIcon>

export const manualVerification = () => {
  const verificationStatus: VerificationStatus = {
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
  const verificationStatus: VerificationStatus = {
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
export const loginProviderVerification = () => {
  const verificationStatus: VerificationStatus = {
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
