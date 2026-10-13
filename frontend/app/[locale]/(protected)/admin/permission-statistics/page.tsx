import type { Metadata } from "next"
import PermissionsClient from "./permissions-client"

export const metadata: Metadata = {
  title: "App permissions",
  robots: { index: false },
}

export default function PermissionsPage() {
  return <PermissionsClient />
}
