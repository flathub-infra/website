import { Metadata } from "next"
import QualityModerationClient from "./quality-moderation-client"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Quality Moderation",
    robots: {
      index: false,
    },
  }
}

export default async function QualityModerationPage() {
  // Protection is handled by:
  // 1. Middleware (edge-level route protection)
  // 2. AdminLayoutClient (client-side permission checks)
  // Server-side auth doesn't work with session-based authentication

  return <QualityModerationClient />
}
