import { redirect } from "src/i18n/navigation"

// This page uses dynamic redirects and should not be statically generated
export const dynamic = "force-dynamic"

export default async function PopularRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  // Redirect to page 1
  redirect({ href: `/apps/collection/popular/1`, locale })
}
