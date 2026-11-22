import { expect, it, vi } from "vitest"
import type { Stripe, StripeElements } from "@stripe/stripe-js"
import { confirmPaymentWalletTransactionsTxnConfirmPost } from "src/codegen"
import { confirmWalletPayment, createCardToken } from "./stripe"

vi.mock("src/codegen", () => ({
  confirmPaymentWalletTransactionsTxnConfirmPost: vi.fn(),
}))

it("opens only the challenge accepted for this submission", async () => {
  const handleNextAction = vi.fn().mockResolvedValue({})
  const stripe = { handleNextAction } as unknown as Stripe
  const confirm = vi.mocked(confirmPaymentWalletTransactionsTxnConfirmPost)
  for (const status of ["view_details", "requires_action"]) {
    confirm.mockResolvedValueOnce({ data: status } as Awaited<
      ReturnType<typeof confirm>
    >)
    await confirmWalletPayment(
      stripe,
      "42",
      { checkout_revision: 4, client_secret: "original-secret" },
      {
        payment_method: "pm_1",
      },
    )
    expect(handleNextAction).toHaveBeenCalledTimes(
      status === "view_details" ? 0 : 1,
    )
  }
  expect(handleNextAction).toHaveBeenCalledWith({
    clientSecret: "original-secret",
  })
  expect(confirm.mock.calls[0][1].checkout_revision).toBe(4)
})

it("waits for the remounted form's unchecked save preference before collecting a card", async () => {
  let finishUpdate: () => void
  const elements = {
    update: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishUpdate = resolve
        }),
    ),
    submit: vi.fn(async () => ({})),
  }
  const stripe = {
    createConfirmationToken: vi.fn(async () => ({
      confirmationToken: { id: "ct_1" },
    })),
  }
  const token = createCardToken(
    stripe as unknown as Stripe,
    elements as unknown as StripeElements,
    false,
  )
  expect(elements.update).toHaveBeenCalledWith({ setupFutureUsage: null })
  expect(elements.submit).not.toHaveBeenCalled()
  expect(stripe.createConfirmationToken).not.toHaveBeenCalled()
  finishUpdate()
  expect(await token).toBe("ct_1")
})
