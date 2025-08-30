import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { fetchLoginProviders } from "../../../src/fetchers"
import LoginClient from "./login-client"

export async function generateMetadata({
  params,
}: {
  params: { locale: string }
}): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("login"),
    openGraph: {
      url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/login`,
    },
    robots: {
      index: false,
    },
  }
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  try {
    const providers = await fetchLoginProviders()
    const { locale } = await params

    return <LoginClient providers={providers} locale={locale} />
  } catch (error) {
    notFound()
  }
}
