import { Metadata } from "next"
import UserAdminClient from "./user-admin-client"

interface Props {
  params: Promise<{ user: string }>
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

  return <UserAdminClient userId={user} />
}
