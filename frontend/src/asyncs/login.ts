import { ParsedUrlQuery } from "querystring"
import { Dispatch } from "react"
import { LOGIN_PROVIDERS_URL } from "../env"
import { APIResponseError } from "../types/API"
import { UserStateAction } from "../types/Login"
import { AxiosResponse } from "axios"
import { UserInfo } from "src/codegen/model/userInfo"
import { getUserinfoAuthUserinfoGet } from "src/codegen"

/**
 * Performs the callback POST request to check 3rd party authentication
 * was successful. Fetches user data on success. Throws localized string
 * ID on error.
 * @param dispatch Reducer dispatch function used to update user context
 * @param query URL query object with code and state to POST to backend
 * as well as login provider name to determine the API endpoint
 */
export async function login(
  dispatch: Dispatch<UserStateAction>,
  query: ParsedUrlQuery,
): Promise<void> {
  dispatch({ type: "loading" })

  let res: Response
  try {
    res = await fetch(`${LOGIN_PROVIDERS_URL}/${query.service}`, {
      method: "POST",
      credentials: "include", // Must use the session cookie
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: query.code,
        state: query.state,
      }),
    })
  } catch {
    dispatch({ type: "interrupt" })
    throw new Error("network-error-try-again")
  }

  if (res.ok) {
    getUserData(dispatch)
  } else {
    dispatch({ type: "interrupt" })

    // Some errors come with an explanation from backend, others are unexpected
    const data: APIResponseError = await res.json()

    throw new Error(data.error) ?? new Error("network-error-try-again")
  }
}

/**
 * Retrieved the currently logged in user's data. On error the state of
 * current data is assumed to be unchanged.
 * @param dispatch Reducer dispatch function used to update user context
 */
export async function getUserData(
  dispatch: Dispatch<UserStateAction>,
): Promise<void> {
  // Indicate the user data is being fetched
  dispatch({ type: "loading" })

  // On network error just assume user state is unchanged
  let res: AxiosResponse<UserInfo, any>
  try {
    // Gets data for user with current session cookie
    res = await getUserinfoAuthUserinfoGet({ withCredentials: true })

    // Assuming a bad status indicates unchanged user state
    // A no content status response indicates the user is not logged in
    if (res.status === 204) {
      dispatch({ type: "logout" })
    } else {
      const info: UserInfo = res.data
      dispatch({
        type: "login",
        info,
      })
    }
  } catch {
    dispatch({ type: "interrupt" })
  }
}
