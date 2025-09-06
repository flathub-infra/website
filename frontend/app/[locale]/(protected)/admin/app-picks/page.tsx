import { Metadata } from "next"
import AppPicksClient from "./app-picks-client"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "App Picks",
    robots: {
      index: false,
    },
  }
}

export default async function AppPicksPage() {
  // Protection is handled by:
  // 1. Middleware (edge-level route protection)
  // 2. AdminLayoutClient (client-side permission checks)
  // Server-side auth doesn't work with session-based authentication

  return <AppPicksClient />
}
