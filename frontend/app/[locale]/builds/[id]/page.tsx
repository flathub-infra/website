import { Metadata } from "next"
import BuildDetailClient from "./build-detail-client"

interface Props {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return {
    title: `Build ${id}`,
    description: `A build pipeline details`,
    robots: {
      index: false,
    },
  }
}

export default async function BuildDetailPage({ params }: Props) {
  const { id } = await params
  return <BuildDetailClient pipelineId={id} />
}
