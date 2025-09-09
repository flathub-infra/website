import { Metadata } from "next"
import UserAdminClient from "./user-admin-client"

interface Props {
  params: Promise<{ user: string; locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { user } = await params

  return {
    title: user,
    robots: {
      index: false,
    },
  }
}

export default async function UserAdminPage({ params }: Props) {
  const { user } = await params

  // Protection is handled by:
  // 1. Middleware (edge-level route protection)
  // 2. AdminLayoutClient (client-side permission checks)
  // Server-side auth doesn't work with session-based authentication

  return <UserAdminClient userId={user} />
}
