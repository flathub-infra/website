import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import WalletClient from "./wallet-client"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("user-wallet"),
    robots: {
      index: false,
    },
  }
}

export default async function WalletPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  return <WalletClient />
}
