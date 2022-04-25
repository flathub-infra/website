import { TOKEN_GENERATION_URL } from "../env"

/**
 * Generates a token to download a set of apps.
 * @param appids A list of app IDs to generate tokens for
 */
export async function generateTokens(appids: string[]) {
  try {
    let res = await fetch(TOKEN_GENERATION_URL, {
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
