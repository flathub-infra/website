import {
  getAppstreamAppstreamAppIdGet,
  getGlobalVendingConfigVendingConfigGet,
} from "../../../../../src/codegen"
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
  try {
    const response = await getAppstreamAppstreamAppIdGet(appId, { locale })
    const app = response.data
    const appName = app?.name || appId

    return {
      title: appName,
      robots: {
        index: false,
        follow: false,
      },
    }
  } catch {
    return {
      title: appId,
      robots: {
        index: false,
        follow: false,
      },
    }
  }
}

export default async function ManagePage({ params }: Props) {
  const { appId, locale } = await params
  const [appResponse, vendingConfigResponse] = await Promise.all([
    getAppstreamAppstreamAppIdGet(appId, { locale }).catch(() => null),
    getGlobalVendingConfigVendingConfigGet(),
  ])

  const vendingConfig = vendingConfigResponse.data

  // For manage pages, we allow fallback to show the app ID if app doesn't exist or has error
  const appData = appResponse?.data
    ? (appResponse.data as any)
    : ({
        id: appId,
        name: appId,
        bundle: {},
        type: "desktop",
        icon: "",
      } as Pick<Appstream, "id" | "name" | "bundle" | "type" | "icon">)

  return <ManageClient app={appData} vendingConfig={vendingConfig} />
}
