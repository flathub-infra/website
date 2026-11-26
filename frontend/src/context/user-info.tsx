"use client"

import { usePathname, useSearchParams } from "next/navigation"
import {
  createContext,
  Dispatch,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useReducer,
  useRef,
} from "react"
import { getUserData } from "../asyncs/login"
import { renewUserinfoAuthUserinfoHead } from "../codegen/auth/auth"
import { UserState, UserStateAction } from "../types/Login"
import { contextReducer } from "./reducer"

const initialState: UserState = { loading: true }

export const UserContext = createContext<UserState>(initialState)
export const UserDispatchContext = createContext<
  Dispatch<UserStateAction> | undefined
>(undefined)

function SessionRenewal({
  startLookup,
}: {
  startLookup: () => Dispatch<UserStateAction>
}) {
  const user = useUserContext()
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const accountChecked = useRef(false)
  const check = useEffectEvent(async (signal: AbortSignal) => {
    const applyIfCurrent = startLookup()
    if (!accountChecked.current) {
      const checked = await getUserData(applyIfCurrent, { signal })
      if (!signal.aborted) {
        accountChecked.current = checked
      }
      return
    }
    if (user.loading) {
      return
    }
    try {
      const response = await renewUserinfoAuthUserinfoHead({
        withCredentials: true,
        signal,
      })
      if (signal.aborted) {
        return
      }
      if (response.status === 204 && user.info) {
        applyIfCurrent({ type: "logout" })
      } else if (
        response.status === 200 &&
        (!user.info ||
          response.headers["flathub-account-invite-code"] !==
            user.info.invite_code)
      ) {
        if (user.info) {
          applyIfCurrent({ type: "logout" })
        }
        await getUserData(applyIfCurrent, { signal, background: true })
      }
    } catch {
      // Keep the account visible on a network error and retry on navigation.
    }
  })

  useEffect(() => {
    const controller = new AbortController()
    void check(controller.signal)
    return () => controller.abort()
  }, [pathname, search])

  return null
}

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
  const revision = useRef(0)
  const dispatchUserAction = useCallback((action: UserStateAction) => {
    revision.current++
    dispatch(action)
  }, [])
  function startLookup(): Dispatch<UserStateAction> {
    const previousRevision = revision.current
    return (action) => {
      if (revision.current === previousRevision) {
        dispatch(action)
      }
    }
  }
  return (
    <UserContext value={user}>
      <UserDispatchContext value={dispatchUserAction}>
        <Suspense fallback={null}>
          <SessionRenewal startLookup={startLookup} />
        </Suspense>
        {children}
      </UserDispatchContext>
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
