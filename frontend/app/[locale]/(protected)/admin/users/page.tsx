import { Metadata } from "next"
import UsersClient from "./users-client"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Users",
    robots: {
      index: false,
    },
  }
}

export default async function UsersPage() {
  // Protection is handled by:
  // 1. Middleware (edge-level route protection)
  // 2. AdminLayoutClient (client-side permission checks)
  // Server-side auth doesn't work with session-based authentication

  return <UsersClient />
}
