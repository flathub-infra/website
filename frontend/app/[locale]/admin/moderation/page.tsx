import { Metadata } from "next"
import ModerationClient from "./moderation-client"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Moderation",
    robots: {
      index: false,
    },
  }
}

export default async function ModerationPage() {
  return <ModerationClient />
}
