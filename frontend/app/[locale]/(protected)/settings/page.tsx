import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import {
  getLoginMethodsAuthLoginGet,
  LoginMethod,
} from "../../../../src/codegen"
import SettingsClient from "./settings-client"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations()

  return {
    title: t("settings"),
    robots: {
      index: false,
    },
  }
}

export default async function SettingsPage() {
  let providers: LoginMethod[]

  try {
    const response = await getLoginMethodsAuthLoginGet()
    providers = response.data
  } catch (error) {
    notFound()
  }

  return <SettingsClient providers={providers} />
}
