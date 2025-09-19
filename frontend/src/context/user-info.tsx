"use client"

import {
  createContext,
  Dispatch,
  useContext,
  useEffect,
  useReducer,
} from "react"
import { getUserData } from "../asyncs/login"
import { UserState, UserStateAction } from "../types/Login"
import { contextReducer } from "./reducer"

const initialState: UserState = { loading: true }

export const UserContext = createContext<UserState>(initialState)
export const UserDispatchContext = createContext<
  Dispatch<UserStateAction> | undefined
>(undefined)

export const UserInfoProvider = ({
  children,
  userContext,
}: {
  children: React.ReactNode
  userContext?: UserState
}) => {
  const [user, dispatch] = useReducer(
    contextReducer,
    userContext ?? initialState,
  )

  // Fetch the user data only the first time the provider is created
  // This works thanks to Next.js Link components, as soon as a new
  // session is created this will re-fetch
  useEffect(() => {
    if (typeof window !== "undefined") {
      getUserData(dispatch)
    }
  }, [])

  return (
    <UserContext value={user}>
      <UserDispatchContext value={dispatch}>{children}</UserDispatchContext>
    </UserContext>
  )
}

// Custom hooks to use the contexts make code cleaner elsewhere
export function useUserContext() {
  const context = useContext(UserContext)
  // The context will always have a value because we provide a default
  return context
}
export function useUserDispatch() {
  const dispatch = useContext(UserDispatchContext)
  if (dispatch === undefined) {
    // Return noop function for SSR
    if (typeof window === "undefined") {
      return () => {}
    }
    throw new Error("useUserDispatch must be used within a UserInfoProvider")
  }
  return dispatch
}
