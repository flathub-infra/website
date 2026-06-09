import { Metadata } from "next"
import DirectUploadsClient from "./direct-uploads-client"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Direct uploads",
    robots: {
      index: false,
    },
  }
}

export default async function DirectUploadsPage() {
  // Protection is handled by:
  // 1. Middleware (edge-level route protection)
  // 2. AdminLayoutClient (client-side permission checks)
  // Server-side auth doesn't work with session-based authentication

  return <DirectUploadsClient />
}
