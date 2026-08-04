import { Metadata } from "next"
import BuildsClient from "./builds-client"

export const dynamic = "force-static"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Builds",
    description: "Monitor build and deployment processes",
    robots: {
      index: false,
    },
  }
}

export default function BuildsPage() {
  return <BuildsClient />
}
