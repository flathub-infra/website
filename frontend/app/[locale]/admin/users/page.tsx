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
  return <UsersClient />
}
