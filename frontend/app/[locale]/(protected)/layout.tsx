import { ReactNode } from "react"
import ProtectedLayoutClient from "./protected-layout-client"

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode
}) {
  // For now, rely on middleware + client-side protection
  // Server-side cookie forwarding has issues with the current backend setup
  // The middleware will still block unauthorized access at the edge level
  return <ProtectedLayoutClient>{children}</ProtectedLayoutClient>
}
