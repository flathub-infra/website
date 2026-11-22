import { Stripe, StripeElements, StripeError } from "@stripe/stripe-js"
import { confirmPaymentWalletTransactionsTxnConfirmPost } from "src/codegen"
import type {
  ConfirmNewCard,
  ConfirmSavedCard,
  TransactionStripeData,
} from "src/codegen/model"

export type CheckoutIntent = Pick<
  TransactionStripeData,
  "client_secret" | "checkout_revision"
>

export async function confirmWalletPayment(
  stripe: Stripe,
  transactionId: string,
  intent: CheckoutIntent,
  payment:
    | Omit<ConfirmSavedCard, "checkout_revision">
    | Omit<ConfirmNewCard, "checkout_revision">,
) {
  const { data: status } = await confirmPaymentWalletTransactionsTxnConfirmPost(
    transactionId,
    { ...payment, checkout_revision: intent.checkout_revision },
    { withCredentials: true },
  )
  if (typeof status === "object") {
    handleStripeError({
      type: "card_error",
      code: status.code ?? undefined,
      decline_code: status.decline_code ?? undefined,
    })
  } else if (status === "requires_action") {
    await authenticatePayment(stripe, intent.client_secret)
  }
}

export async function authenticatePayment(
  stripe: Stripe,
  clientSecret: string,
) {
  const { error } = await stripe.handleNextAction({ clientSecret })
  if (error) {
    handleStripeError(error)
  }
}

export async function createCardToken(
  stripe: Stripe,
  elements: StripeElements,
  saveCard: boolean,
) {
  await elements.update({ setupFutureUsage: saveCard ? "on_session" : null })
  const submitted = await elements.submit()
  if (submitted.error) {
    handleStripeError(submitted.error)
  }
  const token = await stripe.createConfirmationToken({ elements })
  if (token.error) {
    handleStripeError(token.error)
  }
  return token.confirmationToken.id
}

export function handleStripeError(stripeError: StripeError) {
  switch (stripeError.type) {
    case "validation_error":
      throw "stripe-validation-error"
    // Card error occurs when insufficient funds, etc.
    case "card_error":
      // https://stripe.com/docs/declines/codes
      if (stripeError.decline_code) {
        // Lost and stolen cards should be presented as a generic decline
        // https://stripe.com/docs/declines/codes#lost_card
        throw stripeError.decline_code === "insufficient_funds"
          ? "stripe-declined-insufficient_funds"
          : "stripe-declined-generic_decline"
      }
      if (
        ![
          "expired_card",
          "incorrect_cvc",
          "incorrect_number",
          "payment_intent_authentication_failure",
          "processing_error",
        ].includes(stripeError.code)
      ) {
        throw "stripe-declined-generic_decline"
      }

    // Less specific card errors fallback to the error code
    case "invalid_request_error":
      // https://stripe.com/docs/error-codes
      throw `stripe-error-${stripeError.code}`
    case "api_error":
      throw "stripe-api-error"
    default:
      throw "network-error-try-again"
  }
}

export function paymentErrorMessage(error: unknown) {
  return typeof error === "string" ? error : "transaction-went-wrong"
}
