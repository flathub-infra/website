import {
  VENDING_DASHBOARD_URL,
  VENDING_ONBOARDING_URL,
  VENDING_STATUS_URL,
} from "../env"
import { VendingRedirect, VendingStatus } from "../types/Vending"

// API responds with this status code if onboarding has not begun
const STATUS_NEW = 201

const DEFAULT_STATUS: VendingStatus = {
  status: "ok",
  can_take_payments: false,
  details_submitted: false,
  needs_attention: false,
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
        return_url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/userpage`,
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
