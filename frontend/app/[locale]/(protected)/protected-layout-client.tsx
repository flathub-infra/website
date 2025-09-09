"use client"

import { ReactNode } from "react"
import { useUserContext } from "../../../src/context/user-info"
import Spinner from "../../../src/components/Spinner"

interface ProtectedLayoutClientProps {
  children: ReactNode
}

export default function ProtectedLayoutClient({
  children,
}: ProtectedLayoutClientProps) {
  const user = useUserContext()

  if (user.loading || user.info === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spinner size="m" />
      </div>
    )
  }

  return <>{children}</>
}
