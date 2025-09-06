import { fetchAppstream } from "../../../../../../src/fetchers"
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
  const app = await fetchAppstream(appId, locale)
  const appName = app?.name || appId

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
  const app = await fetchAppstream(appId, locale)

  // For manage pages, we allow fallback to show the app ID if app doesn't exist
  const appData = app ?? { id: appId, name: appId }

  return <AcceptInviteClient app={appData} />
}
