import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import RegisterClient from "./register-client"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("new-direct-upload"),
    robots: {
      index: false,
    },
  }
}

export default function RegisterPage() {
  return <RegisterClient />
}
