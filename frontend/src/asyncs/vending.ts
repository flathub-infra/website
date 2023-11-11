import {
  VENDING_APP_SPLIT_URL,
  VENDING_APP_STATUS_URL,
  VENDING_TOKENS_URL,
} from "../env"
import { APIResponseError } from "../types/API"
import {
  VendingDescriptor,
  VendingSplit,
  VendingTokenList,
} from "../types/Vending"

const DEFAULT_DESCRIPTOR: VendingDescriptor = {
  status: "ok",
  currency: "usd",
  components: [],
  fee_fixed_cost: 0,
  fee_cost_percent: 0,
  fee_prefer_percent: 0,
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
