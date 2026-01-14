import { Metadata } from "next"
import AppBuildStatusClient from "./app-build-status-client"

interface Props {
  params: Promise<{
    appId: string
  }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { appId } = await params
  return {
    title: `Build Status - ${appId}`,
    description: `Build status and history for ${appId}`,
    robots: {
      index: false,
    },
  }
}

export default async function AppBuildStatusPage({ params }: Props) {
  const { appId } = await params
  return <AppBuildStatusClient appId={appId} />
}
