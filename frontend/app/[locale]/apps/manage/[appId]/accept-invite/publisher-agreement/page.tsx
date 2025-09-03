import { Metadata } from "next"
import PublisherAgreementClient from "./publisher-agreement-client"
import getTranslations from "next-intl/dist/types/server/react-server/getTranslations"

interface Props {
  params: Promise<{
    appId: string
  }>
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  return {
    title: t("publisher-agreement"),
    robots: {
      index: false,
    },
  }
}

export default async function PublisherAgreementPage({ params }: Props) {
  const { appId } = await params
  return <PublisherAgreementClient appId={appId} />
}
