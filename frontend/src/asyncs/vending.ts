import {
  VENDING_APP_SETUP_URL,
  VENDING_APP_SPLIT_URL,
  VENDING_APP_STATUS_URL,
  VENDING_DASHBOARD_URL,
  VENDING_ONBOARDING_URL,
  VENDING_STATUS_URL,
  VENDING_TOKENS_CANCEL_URL,
  VENDING_TOKENS_REDEEM_URL,
  VENDING_TOKENS_URL,
} from "../env"
import { APIResponseError } from "../types/API"
import {
  ProposedPayment,
  VendingDescriptor,
  VendingOutput,
  VendingRedirect,
  VendingSetup,
  VendingSplit,
  VendingStatus,
  VendingTokenCancellation,
  VendingTokenList,
  VendingTokenRedemption,
} from "../types/Vending"

// API responds with this status code if onboarding has not begun
const STATUS_NEW = 201

const DEFAULT_STATUS: VendingStatus = {
  status: "ok",
  can_take_payments: false,
  details_submitted: false,
  needs_attention: false,
}

const DEFAULT_SETUP: VendingSetup = {
  currency: "usd",
  appshare: 50,
  minimum_payment: 0,
  recommended_donation: 0,
}

const DEFAULT_DESCRIPTOR: VendingDescriptor = {
  status: "ok",
  currency: "usd",
  components: [],
  fee_fixed_cost: 0,
  fee_cost_percent: 0,
  fee_prefer_percent: 0,
}

/**
 * Retrieve the vending status of the logged in user.
 * @returns The vending status object
 */
export async function getVendingStatus(): Promise<VendingStatus> {
  let res: Response
  try {
    res = await fetch(VENDING_STATUS_URL, { credentials: "include" })
  } catch {
    throw "failed-to-load-refresh"
  }

  if (res.ok) {
    if (res.status === STATUS_NEW) {
      return DEFAULT_STATUS
    }

    const data: VendingStatus = await res.json()
    return data
  } else {
    throw "failed-to-load-refresh"
  }
}

export async function getDashboardLink(): Promise<string> {
  let res: Response
  try {
    res = await fetch(VENDING_DASHBOARD_URL, { credentials: "include" })
  } catch {
    throw "failed-to-load-refresh"
  }

  if (res.ok) {
    const data: VendingRedirect = await res.json()
    return data.target_url
  } else {
    throw "failed-to-load-refresh"
  }
}

export async function getOnboardingLink(): Promise<string> {
  let res: Response
  try {
    res = await fetch(VENDING_ONBOARDING_URL, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        return_url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/my-flathub`,
      }),
    })
  } catch {
    throw "network-error-try-again"
  }

  if (res.ok) {
    const data: VendingRedirect = await res.json()
    return data.target_url
  } else {
    throw "network-error-try-again"
  }
}

/**
 * Retrieve a description of the vending configuration for a given app.
 * @param appId identifier of an application (e.g. "org.flatpak.qtdemo")
 * @returns application's vending configuration descriptior
 */
export async function getAppVendingStatus(
  appId: string,
): Promise<VendingDescriptor> {
  let res: Response
  try {
    res = await fetch(VENDING_APP_STATUS_URL(appId))
  } catch {
    throw "network-error-try-again"
  }

  // No content indicates there is no valid setup
  if (res.status === 204) {
    return DEFAULT_DESCRIPTOR
  }

  if (res.ok) {
    const data: VendingDescriptor = await res.json()
    return data
  } else {
    throw "network-error-try-again"
  }
}

/**
 * Get the vending setup of an application (for use by app author).
 * @param appId identifer of an application (e.g. "org.flatpak.qtdemo")
 * @returns application's vending setup (or a default setup)
 */
export async function getAppVendingSetup(appId: string): Promise<VendingSetup> {
  let res: Response
  try {
    res = await fetch(VENDING_APP_SETUP_URL(appId), { credentials: "include" })
  } catch {
    throw "failed-to-load-refresh"
  }

  // No content indicates there is no valid setup set
  if (res.status === 204) {
    return DEFAULT_SETUP
  }

  if (res.ok) {
    const data: VendingSetup = await res.json()
    return data
  } else {
    throw "failed-to-load-refresh"
  }
}

/**
 * Configure the vending setup of an application (for use by app author).
 * @param appId identifer of an application (e.g. "org.flatpak.qtdemo")
 * @param setup desired setup for application's vending
 * @returns application's vending setup
 */
export async function setAppVendingSetup(
  appId: string,
  setup: VendingSetup,
): Promise<VendingDescriptor> {
  let res: Response
  try {
    res = await fetch(VENDING_APP_SETUP_URL(appId), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(setup),
    })
  } catch {
    throw "network-error-try-again"
  }

  // No content indicates the setup was cleared
  if (res.status === 204) {
    return DEFAULT_DESCRIPTOR
  }

  if (res.ok) {
    const data: VendingDescriptor = await res.json()
    return data
  } else {
    throw "network-error-try-again"
  }
}

export async function getAppVendingSplit(
  appId: string,
  currency: string,
  value: number,
): Promise<VendingSplit> {
  let res: Response
  try {
    res = await fetch(VENDING_APP_SPLIT_URL(appId, currency, value))
  } catch {
    throw "network-error-try-again"
  }

  if (res.ok) {
    const data: VendingSplit = await res.json()
    return data
  } else {
    throw "network-error-try-again"
  }
}

export async function initiateAppPayment(
  appId: string,
  payment: ProposedPayment,
): Promise<VendingOutput> {
  let res: Response
  try {
    res = await fetch(VENDING_APP_STATUS_URL(appId), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payment),
    })
  } catch {
    throw "network-error-try-again"
  }

  if (res.ok) {
    const data: VendingOutput = await res.json()
    return data
  } else {
    // Some errors come with an explanation from backend, others are unexpected
    const data: APIResponseError = await res.json()

    const msg = {
      "stripe-payment-intent-build-failed": "payment-provider-error",
    }[data.error]

    throw msg ?? "network-error-try-again"
  }
}

export async function getVendingTokens(
  appId: string,
): Promise<VendingTokenList> {
  let res: Response
  try {
    res = await fetch(VENDING_TOKENS_URL(appId), {
      method: "GET",
      credentials: "include",
    })
  } catch {
    throw "network-error-try-again"
  }

  if (res.ok) {
    const data: VendingTokenList = await res.json()
    return data
  } else {
    throw "network-error-try-again"
  }
}

export async function createVendingTokens(
  appId: string,
  names: string[],
): Promise<VendingTokenList> {
  let res: Response
  try {
    res = await fetch(VENDING_TOKENS_URL(appId), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(names),
    })
  } catch {
    throw "network-error-try-again"
  }

  if (res.ok) {
    const data: VendingTokenList = await res.json()
    return data
  } else {
    const data: APIResponseError = await res.json()

    const msg = {
      "permission-denied": "permission-denied",
    }[data.error]

    throw msg ?? "network-error-try-again"
  }
}

export async function cancelVendingTokens(
  appId: string,
  tokens: string[],
): Promise<VendingTokenCancellation[]> {
  let res: Response
  try {
    res = await fetch(VENDING_TOKENS_CANCEL_URL(appId), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tokens),
    })
  } catch {
    throw "network-error-try-again"
  }

  if (res.ok) {
    const data: VendingTokenCancellation[] = await res.json()
    return data
  } else {
    const data: APIResponseError = await res.json()

    const msg = {
      "permission-denied": "permission-denied",
    }[data.error]

    throw msg ?? "network-error-try-again"
  }
}

export async function redeemVendingToken(
  appId: string,
  token: string,
): Promise<VendingTokenRedemption> {
  let res: Response
  try {
    res = await fetch(VENDING_TOKENS_REDEEM_URL(appId, token), {
      method: "POST",
      credentials: "include",
    })
  } catch {
    throw "network-error-try-again"
  }

  if (res.ok) {
    const data: VendingTokenRedemption = await res.json()
    return data
  } else {
    const data: APIResponseError = await res.json()

    const msg = {
      "already-owned": "network-error-try-again",
    }[data.error]

    throw msg ?? "network-error-try-again"
  }
}
