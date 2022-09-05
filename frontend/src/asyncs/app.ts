import { APP_DETAILS, CHECK_PURCHASES_URL, TOKEN_GENERATION_URL } from "../env"
import { Appstream } from "../types/Appstream"

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

/**
 * Fetches the appstream data for a set of apps (e.g. the user's).
 * @param appIds array of app identifiers to fetch data for
 */
export async function getAppsInfo(
  appIds: string[],
): Promise<Partial<Appstream>[]> {
  const responses = await Promise.all(
    appIds.map(async (id) => ({ id, res: await fetch(`${APP_DETAILS(id)}`) })),
  )

  /* If an app doesn't have appstream data yet, just return the ID. */
  return Promise.all(
    responses.map(
      async ({ id, res }) =>
        ((await res.json()) as Promise<Appstream>) ?? { id },
    ),
  )
}
