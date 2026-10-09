"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { runWithReauth } from "src/asyncs/reauth"
import ReauthDialog from "src/components/ReauthDialog"

export function useReauth() {
  const [shown, setShown] = useState(false)
  const resolver = useRef<((authenticated: boolean) => void) | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      resolver.current?.(false)
      resolver.current = null
    }
  }, [])

  const reauthenticate = useCallback(() => {
    if (!mounted.current) return Promise.resolve(false)
    resolver.current?.(false)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
      setShown(true)
    })
  }, [])

  const finish = useCallback((authenticated: boolean) => {
    resolver.current?.(authenticated)
    resolver.current = null
    setShown(false)
  }, [])

  const withReauth = useCallback(
    <T,>(action: () => Promise<T>) => runWithReauth(action, reauthenticate),
    [reauthenticate],
  )

  return {
    withReauth,
    reauthDialog: shown ? (
      <ReauthDialog
        shown={shown}
        onReauthenticated={() => finish(true)}
        onCancelled={() => finish(false)}
      />
    ) : (
      <></>
    ),
  }
}
