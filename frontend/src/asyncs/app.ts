import { CHECK_PURCHASES_URL, TOKEN_GENERATION_URL } from "../env"

/**
 * Checks whether the logged in user owns all of the given apps.
 * @param appids A list of app IDs to check
 */
export async function checkPurchases(appids: string[]) {
  try {
    let res = await fetch(CHECK_PURCHASES_URL, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(appids),
    })

    return await res.json()
  } catch {
    throw "network-error-try-again"
  }
}

/**
 * Generates an update token for the logged in user.
 */
export async function generateUpdateToken() {
  try {
    let res = await fetch(TOKEN_GENERATION_URL, {
      method: "POST",
      credentials: "include",
    })

    return await res.json()
  } catch {
    throw "network-error-try-again"
  }
}
