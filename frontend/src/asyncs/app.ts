import axios, { AxiosResponse } from "axios"
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
export async function getAppsInfo(appIds: string[]): Promise<Appstream[]> {
  const responses = await Promise.allSettled(
    appIds.map(async (id) => ({
      id,
      response: await axios.get<Appstream>(`${APP_DETAILS(id)}`).catch(() => {
        return {
          data: {
            id: id,
            name: id,
          } as Appstream,
        } as AxiosResponse<Appstream>
      }),
    })),
  )

  return responses.map((res) => {
    if (res.status === "fulfilled") {
      return res.value.response.data
    } else {
      return {
        id: "error",
        name: "Error",
      } as Appstream
    }
  })
}
