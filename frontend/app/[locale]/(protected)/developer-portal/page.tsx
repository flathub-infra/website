import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import DeveloperPortalClient from "./developer-portal-client"
import { robustFetchJson } from "src/utils/fetch"

type DocusaurusFeed = {
  version: string
  title: string
  home_page_url: string
  description: string
  items: {
    id: string
    content_html: string
    url: string
    title: string
    summary: string
    date_modified: string
    author: { name: string; url: string }
    tags: string[]
  }[]
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("developer-portal.title"),
    robots: {
      index: false,
    },
  }
}

export default async function DeveloperPortalPage() {
  try {
    const feed: DocusaurusFeed = await robustFetchJson<DocusaurusFeed>(
      "https://docs.flathub.org/blog/feed.json",
    )

    return <DeveloperPortalClient feed={feed} />
  } catch (error) {
    notFound()
  }
}
