import { notFound } from "next/navigation"
import { Suspense } from "react"
import { resolveTranslationLanguage } from "src/components/application/translationLanguages"
import AppTranslations from "./workspace"

export const metadata = { title: "App translations", robots: { index: false } }

export default async function Page({
  params,
}: {
  params: Promise<{ language?: string[] }>
}) {
  const { language = [] } = await params
  const selected = resolveTranslationLanguage(language[0])
  if (language.length > 1 || (language.length === 1 && !selected)) {
    notFound()
  }
  return (
    <Suspense>
      <AppTranslations key={selected} language={selected} />
    </Suspense>
  )
}
