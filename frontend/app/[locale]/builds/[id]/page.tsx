import { translationMessages } from "../../../../i18n/request"
import { Metadata } from "next"
import BuildDetailClient from "./build-detail-client"

interface Props {
  params: {
    id: string
    locale: string
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `Build ${params.id}`,
    description: `A build pipeline details`,
    openGraph: {
      url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/builds/${params.id}`,
    },
    robots: params.locale === "en-GB" ? { index: false } : undefined,
  }
}

export default async function BuildDetailPage({ params }: Props) {
  const messages = await translationMessages(params.locale)

  return (
    <BuildDetailClient 
      pipelineId={params.id} 
      locale={params.locale}
      messages={messages} 
    />
  )
}
