const BASE_URI: string = process.env.NEXT_PUBLIC_API_BASE_URI

export const APPS_IN_PREVIEW_COUNT: number = 12

export const LOGIN_PROVIDERS_URL: string = `${BASE_URI}/auth/login`

export const IS_PRODUCTION: boolean =
  process.env.NEXT_PUBLIC_IS_PRODUCTION === "true"

// Stripe can handle at most an 8 digit single transaction
export const STRIPE_MAX_PAYMENT = 999999.99
// Flathub enforces a minimum payment amount of $1 to cover fees
export const FLATHUB_MIN_PAYMENT = 2
