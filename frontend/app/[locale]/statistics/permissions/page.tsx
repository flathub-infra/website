import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import PermissionStats from "src/components/moderation/PermissionStats"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({
    locale,
    namespace: "permission-statistics",
  })
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}/statistics/permissions`,
    },
  }
}

export default function PermissionStatisticsPage() {
  return <PermissionStats />
}
