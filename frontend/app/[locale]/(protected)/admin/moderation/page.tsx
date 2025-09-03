import { Metadata } from "next"
import ModerationClient from "./moderation-client"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Moderation",
    robots: {
      index: false,
    },
  }
}

export default async function ModerationPage() {
  // Protection is handled by:
  // 1. Middleware (edge-level route protection)
  // 2. AdminLayoutClient (client-side permission checks)
  // Server-side auth doesn't work with session-based authentication

  return <ModerationClient />
}
