// @vitest-environment jsdom
import { act, type PropsWithChildren } from "react"
import { createRoot } from "react-dom/client"
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import PaymentClient from "./payment-client"

const stripe = vi.hoisted(() => ({
  handleNextAction: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  confirm: vi.fn(),
}))
let intentStatus = "requires_action"
let checkoutRevision = 3
let stripeFetch: Promise<void> | undefined
const stripeReads = vi.fn()
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: PropsWithChildren) => children,
  useStripe: () => stripe,
}))
vi.mock("@stripe/stripe-js", () => ({ loadStripe: () => null }))
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("src/i18n/navigation", () => ({ useRouter: () => stripe }))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("src/components/Breadcrumbs", () => ({ default: () => null }))
vi.mock("src/components/login/LoginGuard", () => ({
  default: ({ children }: PropsWithChildren) => children,
}))
vi.mock("src/components/payment/checkout/TermsAgreement", () => ({
  default: ({ onConfirm }: { onConfirm: () => void }) => (
    <button onClick={onConfirm}>Accept terms</button>
  ),
}))
vi.mock("src/components/payment/cards/CardInfo", () => ({
  CardInfo: () => null,
  CardInfoSkeleton: () => null,
}))
vi.mock("src/components/payment/checkout/PaymentForm", () => ({
  default: () => null,
}))
vi.mock("src/components/payment/transactions/TransactionCancelButton", () => ({
  default: () => null,
}))
vi.mock("src/codegen", () => ({
  confirmPaymentWalletTransactionsTxnConfirmPost: stripe.confirm,
  getWalletinfoWalletWalletinfoGet: async () => ({
    data: { cards: [{ id: "pm_1" }] },
  }),
  useGetTransactionByIdWalletTransactionsTxnGet: (
    _id: string,
    { query }: { query: { enabled: boolean; refetchOnMount: "always" } },
  ) =>
    useQuery({
      ...query,
      queryKey: ["transaction"],
      queryFn: () => ({
        data: {
          summary: {
            id: "42",
            kind: "purchase",
            value: 250,
            currency: "usd",
            status: ["success", "cancelled"].includes(intentStatus)
              ? intentStatus
              : "retry",
          },
        },
      }),
    }),
  useGetTxnStripedataWalletTransactionsTxnStripeGet: (
    _id: string,
    { query }: { query: { enabled: boolean; refetchOnMount: "always" } },
  ) =>
    useQuery({
      ...query,
      queryKey: ["stripe"],
      queryFn: async () => {
        await stripeFetch
        stripeReads()
        return {
          data: {
            status: intentStatus === "requires_action" ? intentStatus : "ok",
            client_secret: "original-secret",
            checkout_revision: checkoutRevision,
          },
        }
      },
    }),
}))

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
let client: QueryClient
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  host = document.createElement("div")
  root = createRoot(host)
  client = new QueryClient()
  checkoutRevision = 3
  intentStatus = "requires_action"
})
afterEach(async () => {
  await act(async () => root.unmount())
  client.clear()
  sessionStorage.removeItem("payment_terms_42")
  stripeFetch = undefined
  vi.unstubAllGlobals()
})
function renderCheckout() {
  return act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <PaymentClient transactionId="42" stripePublicKey="pk_test" />
      </QueryClientProvider>,
    ),
  )
}

it.each([
  "succeeded",
  "requires_payment_method",
  "requires_action",
  "success",
  "cancelled",
])(
  "resumes the original challenge and follows Stripe's %s outcome",
  async (outcome) => {
    stripe.handleNextAction.mockImplementationOnce(async () => {
      intentStatus = outcome
      return outcome === "succeeded"
        ? {}
        : {
            error: {
              type: "card_error",
              decline_code: "stolen_card",
              message: "Sensitive decline",
            },
          }
    })
    await renderCheckout()
    await vi.waitFor(async () => {
      await act(async () => {})
      expect(host.querySelector("button")?.textContent).toBe(
        "resume-payment-authentication",
      )
    })
    await act(async () => host.querySelector("button").click())
    expect(stripe.handleNextAction).toHaveBeenCalledWith({
      clientSecret: "original-secret",
    })
    if (outcome === "succeeded") {
      expect(stripe.push).toHaveBeenCalledWith("/payment/details/42")
    } else if (["success", "cancelled"].includes(outcome)) {
      expect(stripe.replace).toHaveBeenCalledWith("/payment/details/42")
      expect(stripeReads).toHaveBeenCalledTimes(2)
    } else {
      await vi.waitFor(async () => {
        await act(async () => {})
        expect(host.querySelector('[role="alert"]')?.textContent).toBe(
          "stripe-declined-generic_decline",
        )
        expect(host.textContent).toContain(
          outcome === "requires_payment_method"
            ? "Accept terms"
            : "resume-payment-authentication",
        )
      })
      if (outcome === "requires_payment_method") {
        await act(async () => host.querySelector("button").click())
        expect(host.textContent).toContain("saved-cards")
      }
      expect(stripe.push).not.toHaveBeenCalled()
    }
  },
)

it.each(["challenge", "decline"])(
  "recovers from an initial saved-card %s without another confirmation",
  async (result) => {
    intentStatus = "requires_payment_method"
    stripe.confirm.mockResolvedValueOnce({
      data:
        result === "challenge"
          ? "requires_action"
          : { code: "card_declined", decline_code: "insufficient_funds" },
    })
    if (result === "challenge") {
      stripe.handleNextAction
        .mockImplementationOnce(async () => {
          intentStatus = "requires_action"
          return { error: { type: "api_error" } }
        })
        .mockResolvedValueOnce({})
    }
    client.setQueryData(["/walletinfo"], { data: { cards: [{ id: "pm_1" }] } })
    async function click(label: string) {
      await vi.waitFor(async () => {
        await act(async () => {})
        expect(
          [...host.querySelectorAll("button")].some(
            (b) => b.textContent === label && !b.disabled,
          ),
        ).toBe(true)
      })
      await act(async () =>
        [...host.querySelectorAll("button")]
          .find((b) => b.textContent === label)
          .click(),
      )
    }
    await renderCheckout()
    await click("Accept terms")
    await click("confirm-selection")
    if (result === "challenge") {
      await click("resume-payment-authentication")
      expect(stripe.push).toHaveBeenCalledWith("/payment/details/42")
    } else {
      await vi.waitFor(() =>
        expect(host.querySelector('[role="alert"]')?.textContent).toBe(
          "stripe-declined-insufficient_funds",
        ),
      )
      expect(host.textContent).toContain("saved-cards")
      expect(stripe.handleNextAction).not.toHaveBeenCalled()
      expect(stripe.push).not.toHaveBeenCalled()
    }
    expect(stripe.confirm).toHaveBeenCalledTimes(1)
  },
)

it("waits for the current intent before offering cached checkout on return", async () => {
  client.setDefaultOptions({ queries: { staleTime: Infinity } })
  client.setQueryData(["stripe"], {
    data: { status: "ok", client_secret: "original-secret" },
  })
  client.setQueryData(["transaction"], {
    data: { summary: { id: "42", kind: "purchase", status: "retry" } },
  })
  let release: () => void
  stripeFetch = new Promise<void>((resolve) => {
    release = resolve
  })
  try {
    await renderCheckout()
    expect(host.textContent).toContain("loading")
    expect(host.querySelector("button")).toBeNull()
    await act(async () => release())
    await vi.waitFor(async () => {
      await act(async () => {})
      expect(host.textContent).toContain("resume-payment-authentication")
    })
  } finally {
    release()
  }
})

it("does not open a newer card's challenge from a stale resume button", async () => {
  await renderCheckout()
  await vi.waitFor(async () => {
    await act(async () => {})
    expect(host.querySelector("button")?.textContent).toBe(
      "resume-payment-authentication",
    )
  })
  checkoutRevision++
  await act(async () => host.querySelector("button").click())
  expect(stripe.handleNextAction).not.toHaveBeenCalled()
  expect(stripe.replace).toHaveBeenCalledWith("/payment/details/42")
})
