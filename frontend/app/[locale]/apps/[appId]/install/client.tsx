"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Appstream } from "src/types/Appstream"
import InstallFallback from "../../../../../src/components/application/InstallFallback"

interface InstallClientProps {
  app: Pick<Appstream, "id" | "name" | "icon">
}

export default function InstallClient({ app }: InstallClientProps) {
  const router = useRouter()

  useEffect(() => {
    // Client-side redirect to flatpakhttps endpoint
    const redirectUrl = `/apps/${app.id}/flatpakhttps`

    // Use a small delay to ensure the fallback content is shown briefly
    // in case the redirect doesn't work immediately
    const timer = setTimeout(() => {
      router.push(redirectUrl)
    }, 100)

    // Also handle immediate redirect for browsers that support it
    router.push(redirectUrl)

    return () => clearTimeout(timer)
  }, [app.id, router])

  // Show the fallback component while redirect is happening
  return (
    <>
      <InstallFallback app={app} />
    </>
  )
}
