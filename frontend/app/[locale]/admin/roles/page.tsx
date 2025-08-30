import { Metadata } from "next"
import RolesClient from "./roles-client"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Users",
    robots: {
      index: false,
    },
  }
}

export default async function RolesPage() {
  return <RolesClient />
}
