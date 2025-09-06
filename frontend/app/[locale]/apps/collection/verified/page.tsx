import { redirect } from "src/i18n/navigation"

export default async function VerifiedRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  // Redirect to page 1
  redirect({ href: `/apps/collection/verified/1`, locale })
}
