import { Metadata } from "next"
import AdminPageClient from "./admin-page-client"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Admin Dashboard",
    robots: {
      index: false,
    },
  }
}

export default async function AdminPage() {
  return <AdminPageClient />
}
