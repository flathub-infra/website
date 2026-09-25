import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import Spinner from "src/components/Spinner"
import EmailConfirmClient from "./email-confirm-client"

export const dynamic = "force-static"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("login"),
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function EmailConfirmPage() {
  return (
    <Suspense fallback={<Spinner size={"m"} />}>
      <EmailConfirmClient />
    </Suspense>
  )
}
