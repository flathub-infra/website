import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import FeedsClient from './feeds-client'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  
  return {
    title: `${t('rss-feeds')} - Flathub`,
    description: t('rss-description'),
    openGraph: {
      url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/feeds`,
    },
  }
}

export default function FeedsPage() {
  return <FeedsClient />
}
