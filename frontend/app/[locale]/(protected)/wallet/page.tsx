import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import WalletClient from "./wallet-client"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("user-wallet"),
    robots: {
      index: false,
    },
  }
}

export default async function WalletPage() {
  return <WalletClient />
}
