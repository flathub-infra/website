import { fetchAppstream, fetchVendingConfig } from "../../../../../src/fetchers"
import { Metadata } from "next"
import ManageClient from "./manage-client"
import { Appstream } from "src/types/Appstream"

interface Props {
  params: Promise<{
    appId: string
    locale: string
  }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { appId, locale } = await params
  const app = await fetchAppstream(appId, locale)

  if ("error" in app) {
    return {
      title: appId,
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const appName = app?.name || appId

  return {
    title: appName,
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function ManagePage({ params }: Props) {
  const { appId, locale } = await params
  const [app, vendingConfig] = await Promise.all([
    fetchAppstream(appId, locale),
    fetchVendingConfig(),
  ])

  // Check for vending config error
  if ("error" in vendingConfig) {
    throw new Error(`Vending config fetch error: ${vendingConfig.error}`)
  }

  // For manage pages, we allow fallback to show the app ID if app doesn't exist or has error
  const appData =
    app && !("error" in app)
      ? app
      : ({
          id: appId,
          name: appId,
          bundle: {},
          type: "desktop",
          icon: "",
        } as Pick<Appstream, "id" | "name" | "bundle" | "type" | "icon">)

  return <ManageClient app={appData} vendingConfig={vendingConfig} />
}
