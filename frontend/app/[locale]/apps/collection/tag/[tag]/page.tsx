import { redirect } from "src/i18n/navigation"

interface Props {
  params: Promise<{
    tag: string
    locale: string
  }>
}

export default async function TagRedirectPage({ params }: Props) {
  const { tag, locale } = await params

  // Redirect to page 1
  redirect({
    href: `/apps/collection/tag/${encodeURIComponent(tag)}/1`,
    locale,
  })
}
