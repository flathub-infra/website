import { redirect } from "src/i18n/navigation"

export default async function CategoryRedirect({
  params,
}: {
  params: Promise<{ locale: string; category: string }>
}) {
  const { locale, category } = await params

  // Always redirect to page 1
  redirect({ href: `/apps/category/${category}/1`, locale })
}
