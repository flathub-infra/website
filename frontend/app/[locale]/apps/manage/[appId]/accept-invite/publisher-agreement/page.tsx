import { translationMessages } from "../../../../../../../i18n/request"
import { Metadata } from "next"
import PublisherAgreementClient from "./publisher-agreement-client"

interface Props {
  params: {
    appId: string
    locale: string
  }
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
  const messages = await translationMessages(params.locale)

  return (
    <PublisherAgreementClient 
      appId={params.appId} 
      messages={messages}
    />
  )
}
