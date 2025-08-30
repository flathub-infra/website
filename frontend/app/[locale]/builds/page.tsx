import { translationMessages } from "../../../i18n/request"
import { Metadata } from "next"
import BuildsClient from "./builds-client"

interface Props {
  params: {
    locale: string
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: "Builds",
    description: "Monitor build and deployment processes",
    openGraph: {
      url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/builds`,
    },
    robots: params.locale === "en-GB" ? { index: false } : undefined,
  }
}

export default async function BuildsPage({ params }: Props) {
  const messages = await translationMessages(params.locale)

  return <BuildsClient messages={messages} />
}
