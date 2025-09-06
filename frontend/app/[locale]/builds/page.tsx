import { Metadata } from "next"
import BuildsClient from "./builds-client"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Builds",
    description: "Monitor build and deployment processes",
  }
}

export default async function BuildsPage() {
  return <BuildsClient />
}
