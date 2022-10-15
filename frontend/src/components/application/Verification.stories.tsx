import React from "react"
import { ComponentMeta } from "@storybook/react"
import Verification from "./Verification"
import { VerificationStatus } from "../../types/VerificationStatus"
export default {
  title: "Components/Application/Verification",
  component: Verification,
} as ComponentMeta<typeof Verification>

export const Generated = () => {
  const verificationStatus: VerificationStatus = { verified: true }
  return <Verification verificationStatus={verificationStatus} />
}
