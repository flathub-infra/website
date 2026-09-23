import { Metadata } from "next"
import ReproducibleClient from "./reproducible-client"

export const dynamic = "force-static"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Build reproducibility",
    description: "Reproducibility of published stable builds",
    robots: { index: false },
  }
}

export default function ReproduciblePage() {
  return <ReproducibleClient />
}
