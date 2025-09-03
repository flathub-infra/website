import { Metadata } from "next"
import RolesClient from "./roles-client"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Roles",
    robots: {
      index: false,
    },
  }
}

export default async function RolesPage() {
  // Protection is handled by:
  // 1. Middleware (edge-level route protection)
  // 2. AdminLayoutClient (client-side permission checks)
  // Server-side auth doesn't work with session-based authentication

  return <RolesClient />
}
