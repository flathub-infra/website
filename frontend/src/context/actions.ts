import { ParsedUrlQuery } from "querystring";
import { Dispatch } from "react";
import { LOGIN_PROVIDERS_URL, USER_INFO_URL } from "../env";
import { UserStateAction } from "../types/Login";

export async function login(dispatch: Dispatch<UserStateAction>, query: ParsedUrlQuery) {
  dispatch({type: 'loading'})

  const res = await fetch(`${LOGIN_PROVIDERS_URL}/github`, {
    method: 'POST',
    credentials: 'include', // Must use the session cookie
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: query.code,
      state: query.state,
    })
  })

  if (res.ok) {
    getUserData(dispatch)
  } else {
    // Note: Some of these come with an error message from backend we could display
    dispatch({type: 'logout'})
  }
}

export async function getUserData(dispatch: Dispatch<UserStateAction>) {
  // Indicate the user data is being fetched
  dispatch({type: 'loading'})

  // Gets data for user with current session cookie
  const res = await fetch(USER_INFO_URL, { credentials: 'include' })

  // 403 indicates not currently logged in
  if (res.status === 403) {
    dispatch({type: 'logout'})
  } else {
    const info = await res.json()
    dispatch({
      type: 'login',
      info
    })
  }
}

export function logout(dispatch: Dispatch<UserStateAction>) {
  dispatch({type: 'logout'})
}
