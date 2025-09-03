import { redirect } from "src/i18n/navigation"

interface Props {
  params: Promise<{
    developer: string
    locale: string
  }>
}

export default async function DeveloperRedirectPage({ params }: Props) {
  const { developer, locale } = await params

  // Redirect to page 1
  redirect({
    href: `/apps/collection/developer/${encodeURIComponent(developer)}/1`,
    locale: locale,
  })
}
