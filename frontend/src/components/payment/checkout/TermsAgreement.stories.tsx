import React from "react"
import { ComponentMeta } from "@storybook/react"
import TermsAgreement from "./TermsAgreement"
import Button from "../../Button"

export default {
  title: "Components/Payment/TermsAgreement",
  component: TermsAgreement,
} as ComponentMeta<typeof TermsAgreement>

export const Generated = () => {
  return (
    <TermsAgreement
      onConfirm={() => {}}
      transactionCancelButton={<Button>Cancel</Button>}
    />
  )
}
