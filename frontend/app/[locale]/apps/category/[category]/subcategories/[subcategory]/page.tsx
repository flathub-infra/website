import { redirect } from "src/i18n/navigation"

export default async function SubcategoryRedirect({
  params,
}: {
  params: Promise<{ locale: string; category: string; subcategory: string }>
}) {
  const { locale, category, subcategory } = await params

  // Always redirect to page 1
  redirect({
    href: `/apps/category/${category}/subcategories/${subcategory}/1`,
    locale: locale,
  })
}
