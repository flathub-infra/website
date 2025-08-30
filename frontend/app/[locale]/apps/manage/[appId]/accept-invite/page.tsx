import { fetchAppstream } from "../../../../../../src/fetchers"
import { translationMessages } from "../../../../../../i18n/request"
import { Metadata } from "next"
import AcceptInviteClient from "./accept-invite-client"

interface Props {
  params: {
    appId: string
    locale: string
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const app = await fetchAppstream(params.appId, params.locale)
  const appName = app?.name || params.appId

  return {
    title: appName,
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function AcceptInvitePage({ params }: Props) {
  const [app, messages] = await Promise.all([
    fetchAppstream(params.appId, params.locale),
    translationMessages(params.locale),
  ])

  // For manage pages, we allow fallback to show the app ID if app doesn't exist
  const appData = app ?? { id: params.appId, name: params.appId }

  return (
    <AcceptInviteClient 
      app={appData} 
      messages={messages}
    />
  )
}
