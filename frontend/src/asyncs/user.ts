import { USER_DELETION_URL } from "../env"

/**
 * Performs a GET request to the API to initiate user deletion.
 */
export async function requestDeletion() {
  let res: Response
  try {
    res = await fetch(USER_DELETION_URL, { credentials: "include" })
  } catch {
    throw "network-error-try-again"
  }

  if (res.ok) {
    const data = await res.json()
    if (data.status == "ok") {
      return data.token
    } else {
      throw data.message
    }
  } else {
    throw "network-error-try-again"
  }
}
