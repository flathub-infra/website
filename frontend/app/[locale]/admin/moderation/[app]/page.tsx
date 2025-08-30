import { Metadata } from "next"
import AppModerationClient from "./app-moderation-client"

interface Props {
  params: Promise<{ app: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { app } = await params

  return {
    title: app,
    robots: {
      index: false,
    },
  }
}

export default async function AppModerationPage({ params }: Props) {
  const { app } = await params

  return <AppModerationClient appId={app} />
}
