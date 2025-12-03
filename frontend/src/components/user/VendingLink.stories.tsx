import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import VendingLink from "./VendingLink"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse, delay } from "msw"

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

const meta = {
  title: "Components/User/VendingLink",
  component: VendingLink,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
  decorators: [
    (Story) => {
      const queryClient = createQueryClient()
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      )
    },
  ],
} satisfies Meta<typeof VendingLink>

export default meta

type Story = StoryObj<typeof meta>

export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/vending/status", async () => {
          await delay("infinite")
        }),
      ],
    },
  },
}

export const OnboardingNeeded: Story = {
  parameters: {
    docs: {
      description: {
        story: "User has not started the vendor onboarding process yet",
      },
    },
    msw: {
      handlers: [
        http.get("*/vending/status", () => {
          return HttpResponse.json(
            {
              status: "no-stripe-account",
              can_take_payments: false,
              needs_attention: false,
              details_submitted: false,
            },
            { status: 201 },
          )
        }),
      ],
    },
  },
}

export const DashboardLink: Story = {
  parameters: {
    docs: {
      description: {
        story: "User has completed onboarding and can access their dashboard",
      },
    },
    msw: {
      handlers: [
        http.get("*/vending/status", () => {
          return HttpResponse.json({
            status: "ok",
            can_take_payments: true,
            needs_attention: false,
            details_submitted: true,
          })
        }),
        http.get("*/vending/status/dashboardlink", () => {
          return HttpResponse.json({
            status: "ok",
            target_url: "https://connect.stripe.com/express/dashboard",
          })
        }),
      ],
    },
  },
}

export const AttentionNeeded: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "User's vendor account needs attention (amber alert with border)",
      },
    },
    msw: {
      handlers: [
        http.get("*/vending/status", () => {
          return HttpResponse.json({
            status: "ok",
            can_take_payments: false,
            needs_attention: true,
            details_submitted: true,
          })
        }),
        http.get("*/vending/status/dashboardlink", () => {
          return HttpResponse.json({
            status: "ok",
            target_url: "https://connect.stripe.com/express/dashboard",
          })
        }),
      ],
    },
  },
}

export const Error: Story = {
  parameters: {
    docs: {
      description: {
        story: "Error occurred while fetching vendor status (red background)",
      },
    },
    msw: {
      handlers: [
        http.get("*/vending/status", () => {
          return HttpResponse.json(
            { error: "Failed to retrieve vending status" },
            { status: 500 },
          )
        }),
      ],
    },
  },
}
