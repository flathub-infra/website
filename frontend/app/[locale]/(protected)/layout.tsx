import { ReactNode } from "react"
import ProtectedLayoutClient from "./protected-layout-client"

export default async function ProtectedLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // For now, rely on middleware + client-side protection
  // Server-side cookie forwarding has issues with the current backend setup
  // The middleware will still block unauthorized access at the edge level
  return (
    <ProtectedLayoutClient locale={locale} serverUser={null}>
      {children}
    </ProtectedLayoutClient>
  )
}
