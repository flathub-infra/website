import { Meta } from "@storybook/nextjs-vite"
import TermsAgreement from "./TermsAgreement"

export default {
  title: "Components/Payment/TermsAgreement",
  component: TermsAgreement,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
} as Meta<typeof TermsAgreement>

export const Generated = () => {
  return <TermsAgreement onConfirm={() => {}} transactionId={""} />
}
