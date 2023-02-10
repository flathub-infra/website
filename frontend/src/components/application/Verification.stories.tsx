import React from "react"
import { Meta } from "@storybook/react"
import Verification from "./Verification"
import {
  VerificationStatusLoginProvider,
  VerificationStatusManual,
  VerificationStatusWebsite,
} from "../../types/VerificationStatus"
export default {
  title: "Components/Application/Verification",
  component: Verification,
} as Meta<typeof Verification>

export const manualVerification = () => {
  const verificationStatus: VerificationStatusManual = {
    verified: true,
    detail: "",
    method: "manual",
  }
  return (
    <Verification
      appId="org.flathub.Example"
      verificationStatus={verificationStatus}
    />
  )
}
export const websiteVerification = () => {
  const verificationStatus: VerificationStatusWebsite = {
    verified: true,
    detail: "",
    method: "website",
    website: "https://example.com",
  }
  return (
    <Verification
      appId="com.example.Example"
      verificationStatus={verificationStatus}
    />
  )
}
export const loginProviderVerification = () => {
  const verificationStatus: VerificationStatusLoginProvider = {
    verified: true,
    login_name: "user_name",
    method: "login_provider",
    login_provider: "github",
    detail: "",
  }
  return (
    <Verification
      appId="io.github.Example"
      verificationStatus={verificationStatus}
    />
  )
}
