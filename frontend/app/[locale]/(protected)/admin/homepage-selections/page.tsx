import { Metadata } from "next"
import HomepageSelectionsClient from "./homepage-selections-client"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Homepage Selections",
    robots: {
      index: false,
    },
  }
}

export default async function HomepageSelectionsPage() {
  return <HomepageSelectionsClient />
}
