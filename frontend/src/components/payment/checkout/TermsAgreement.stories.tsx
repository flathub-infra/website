import React from "react"
import { Meta } from "@storybook/react"
import TermsAgreement from "./TermsAgreement"

export default {
  title: "Components/Payment/TermsAgreement",
  component: TermsAgreement,
} as Meta<typeof TermsAgreement>

export const Generated = () => {
  return <TermsAgreement onConfirm={() => {}} transactionId={""} />
}
