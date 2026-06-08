import { Metadata } from "next"
import RuntimesClient from "./runtimes-client"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Runtimes",
    robots: {
      index: false,
    },
  }
}

export default async function RuntimesPage() {
  // Protection is handled by:
  // 1. Middleware (edge-level route protection)
  // 2. AdminLayoutClient (client-side permission checks)
  // Server-side auth doesn't work with session-based authentication

  return <RuntimesClient />
}
