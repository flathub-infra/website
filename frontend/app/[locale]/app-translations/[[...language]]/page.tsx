import { notFound } from "next/navigation"
import AppTranslations from "./workspace"

export const metadata = { title: "App translations", robots: { index: false } }

export default async function Page({
  params,
}: {
  params: Promise<{ language?: string[] }>
}) {
  const { language = [] } = await params
  if (
    language.length > 1 ||
    (language[0] &&
      (language[0].length > 40 ||
        !/^[a-z]{2,3}([-_][A-Za-z0-9]{2,8})*(@[a-z]+)?$/.test(language[0])))
  ) {
    notFound()
  }
  return <AppTranslations key={language[0]} language={language[0]} />
}
