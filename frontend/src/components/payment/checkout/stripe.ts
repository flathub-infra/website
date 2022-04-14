import { StripeError } from '@stripe/stripe-js'

export function handleStripeError(stripeError: StripeError) {
  switch (stripeError.type) {
    // Card error occurs when insufficient funds, etc.
    case 'card_error':
      // https://stripe.com/docs/declines/codes
      if (stripeError.decline_code) {
        // Lost and stolen cards should be presented as a generic decline
        // https://stripe.com/docs/declines/codes#lost_card
        if (['lost_card', 'stolen_card'].includes(stripeError.decline_code)) {
          throw 'stripe-declined-generic_decline'
        }

        throw `stripe-declined-${stripeError.decline_code}`
      }

    // Less specific card errors fallback to the error code
    case 'invalid_request_error':
      // https://stripe.com/docs/error-codes
      throw `stripe-error-${stripeError.code}`
    case 'api_error':
      throw 'stripe-api-error'
    default:
      throw 'network-error-try-again'
  }
}
