import { redirect } from "src/i18n/navigation"

interface Props {
  params: {
    developer: string
    locale: string
  }
}

export default function DeveloperRedirectPage({ params }: Props) {
  // Redirect to page 1
  redirect({
    href: `/apps/collection/developer/${encodeURIComponent(params.developer)}/1`,
    locale: params.locale,
  })
}
