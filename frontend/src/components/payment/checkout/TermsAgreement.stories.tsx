import React from "react"
import { Meta } from "@storybook/react"
import { Button } from "@/components/ui/button"
import TermsAgreement from "./TermsAgreement"

export default {
  title: "Components/Payment/TermsAgreement",
  component: TermsAgreement,
} as Meta<typeof TermsAgreement>

export const Generated = () => {
  return (
    <TermsAgreement
      onConfirm={() => {}}
      transactionCancelButton={<Button size="lg">Cancel</Button>}
    />
  )
}
