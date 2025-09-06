import { ReactNode } from "react"
import AdminLayoutClient from "./admin-layout-client"

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Use client-side admin permission checking due to server-side cookie forwarding issues
  // Middleware still provides edge-level protection
  return <AdminLayoutClient locale={locale}>{children}</AdminLayoutClient>
}
