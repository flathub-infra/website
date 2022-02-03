import { Dispatch } from "react";
import { USER_INFO_URL } from "../env";
import { UserStateAction } from "../types/Login";

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
