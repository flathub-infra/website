import { getAppstreamAppstreamAppIdGet } from "../../../../../../src/codegen"
import { Metadata } from "next"
import AcceptInviteClient from "./accept-invite-client"

interface Props {
  params: Promise<{
    appId: string
    locale: string
  }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { appId, locale } = await params
  const response = await getAppstreamAppstreamAppIdGet(appId, { locale }).catch(
    () => null,
  )
  const appName = response?.data?.name || appId

  return {
    title: appName,
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function AcceptInvitePage({ params }: Props) {
  const { appId, locale } = await params
  const response = await getAppstreamAppstreamAppIdGet(appId, { locale }).catch(
    () => null,
  )

  // For manage pages, we allow fallback to show the app ID if app doesn't exist or has error
  const appData = response?.data
    ? (response.data as any)
    : { id: appId, name: appId }

  return <AcceptInviteClient app={appData} />
}
