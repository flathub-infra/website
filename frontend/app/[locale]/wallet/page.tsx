import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import WalletClient from "./wallet-client"

export async function generateMetadata({
  params,
}: {
  params: { locale: string }
}): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("user-wallet"),
    robots: {
      index: false,
    },
  }
}

export default function WalletPage({ params }: { params: { locale: string } }) {
  return <WalletClient />
}
