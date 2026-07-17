import { Meta, StoryObj } from "@storybook/nextjs-vite"
import DnsVerification from "./DnsVerification"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  getConfirmDnsVerificationVerificationAppIdConfirmDnsVerificationPostMockHandler,
  getSetupDnsVerificationVerificationAppIdSetupDnsVerificationPostMockHandler,
} from "../../../codegen/verification/verification.msw"

const TOKEN = "12345678-1234-1234-1234-123456789abc"
const DOMAIN = "example.org"
const RECORD_NAME = `_flathub.${DOMAIN}`

const meta = {
  component: DnsVerification,
  title: "Components/Application/AppVerificationControls/DnsVerification",
  parameters: {
    msw: {
      handlers: [
        getSetupDnsVerificationVerificationAppIdSetupDnsVerificationPostMockHandler(
          {
            domain: DOMAIN,
            record_name: RECORD_NAME,
            token: TOKEN,
          },
        ),
        getConfirmDnsVerificationVerificationAppIdConfirmDnsVerificationPostMockHandler(
          { verified: true },
        ),
      ],
    },
  },
} satisfies Meta<typeof DnsVerification>

export default meta

type Story = StoryObj<typeof meta>

export const NoTokenFirstStep: Story = {
  args: {
    appId: "org.example.App",
    isNewApp: false,
    method: {
      method: "dns",
      dns_domain: DOMAIN,
      dns_record_name: RECORD_NAME,
    },
    onVerified: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole("button", { name: "DNS verification" }),
    )
    await userEvent.click(canvas.getByRole("button", { name: "Begin" }))

    await waitFor(() => {
      expect(canvas.getByText(RECORD_NAME)).toBeInTheDocument()
      expect(canvas.getByText("TXT")).toBeInTheDocument()
      expect(canvas.getByText(TOKEN)).toBeInTheDocument()
    })
  },
}

export const HasTokenSecondStep: Story = {
  args: {
    appId: "org.example.App",
    isNewApp: false,
    method: {
      method: "dns",
      dns_domain: DOMAIN,
      dns_record_name: RECORD_NAME,
      dns_token: TOKEN,
    },
    onVerified: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole("button", { name: "DNS verification" }),
    )

    await waitFor(() => {
      expect(canvas.getByText(RECORD_NAME)).toBeInTheDocument()
      expect(canvas.getByText("TXT")).toBeInTheDocument()
      expect(canvas.getByText(TOKEN)).toBeInTheDocument()
      expect(
        canvas.getByRole("button", { name: "Continue" }),
      ).toBeInTheDocument()
    })
  },
}

export const DnsRecordNotFound: Story = {
  ...HasTokenSecondStep,
  parameters: {
    msw: {
      handlers: [
        getConfirmDnsVerificationVerificationAppIdConfirmDnsVerificationPostMockHandler(
          {
            verified: false,
            detail: "dns_record_not_found",
          },
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole("button", { name: "DNS verification" }),
    )
    await userEvent.click(canvas.getByRole("button", { name: "Continue" }))

    await waitFor(() => {
      expect(
        canvas.getByText(`No TXT record was found at ${RECORD_NAME}.`),
      ).toBeInTheDocument()
      expect(canvas.getByText(RECORD_NAME)).toBeInTheDocument()
      expect(
        canvas.getByRole("button", { name: "Continue" }),
      ).toBeInTheDocument()
    })
  },
}
