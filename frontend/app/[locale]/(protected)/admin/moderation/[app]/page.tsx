import { Metadata } from "next"
import AppModerationClient from "./app-moderation-client"

interface Props {
  params: Promise<{ app: string; locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { app } = await params

  return {
    title: app,
    robots: {
      index: false,
    },
  }
}

export default async function AppModerationPage({ params }: Props) {
  const { app } = await params

  // Protection is handled by:
  // 1. Middleware (edge-level route protection)
  // 2. AdminLayoutClient (client-side permission checks)
  // Server-side auth doesn't work with session-based authentication

  return <AppModerationClient appId={app} />
}
