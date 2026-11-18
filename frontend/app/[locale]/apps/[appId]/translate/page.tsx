import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { isValidAppId } from "@/lib/helpers"
import MetadataTranslationEditor from "src/components/application/MetadataTranslationEditor"
import { metadataTranslationText } from "src/components/application/MetadataTranslationEditor.messages"

export function generateMetadata(): Metadata {
  return {
    title: metadataTranslationText("title"),
    robots: { index: false, follow: false },
  }
}

export default async function TranslatePage({
  params,
  searchParams,
}: {
  params: Promise<{ appId: string }>
  searchParams: Promise<{ language?: string }>
}) {
  const { appId } = await params
  if (!isValidAppId(appId)) {
    notFound()
  }
  const { language } = await searchParams
  return (
    <MetadataTranslationEditor
      appId={appId}
      initialLanguage={typeof language === "string" ? language : undefined}
    />
  )
}
