import { redirect } from "src/i18n/navigation"

interface Props {
  params: {
    tag: string
    locale: string
  }
}

export default function TagRedirectPage({ params }: Props) {
  // Redirect to page 1
  redirect({
    href: `/apps/collection/tag/${encodeURIComponent(params.tag)}/1`,
    locale: params.locale,
  })
}
