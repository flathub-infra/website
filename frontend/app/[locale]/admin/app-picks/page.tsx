import { Metadata } from "next"
import AppPicksClient from "./app-picks-client"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "App Picks",
    robots: {
      index: false,
    },
  }
}

export default async function AppPicksPage() {
  return <AppPicksClient />
}
