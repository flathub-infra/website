import { Metadata } from "next"
import PublisherAgreementClient from "./publisher-agreement-client"

interface Props {
  params: Promise<{
    appId: string
  }>
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Publisher Agreement",
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function PublisherAgreementPage({ params }: Props) {
  const { appId } = await params
  return <PublisherAgreementClient appId={appId} />
}
