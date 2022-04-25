import { USER_DELETION_URL } from "../env"
import { APIResponseError } from "../types/API"
import { UserDeletionToken } from "../types/Login"

/**
 * Performs a GET request to the API to initiate user deletion.
 */
export async function requestDeletion(): Promise<string> {
  let res: Response
  try {
    res = await fetch(USER_DELETION_URL, { credentials: "include" })
  } catch {
    throw "network-error-try-again"
  }

  if (res.ok) {
    const data: UserDeletionToken = await res.json()
    return data.token
  } else {
    const data: APIResponseError = await res.json()

    // NOTE: Once backend has reasons to deny deletion, link errors to translated strings
    const msg = {}[data.error]

    throw msg ?? "network-error-try-again"
  }
}
