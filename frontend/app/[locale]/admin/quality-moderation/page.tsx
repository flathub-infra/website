import { Metadata } from "next"
import QualityModerationClient from "./quality-moderation-client"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Quality Moderation",
    robots: {
      index: false,
    },
  }
}

export default async function QualityModerationPage() {
  return <QualityModerationClient />
}
