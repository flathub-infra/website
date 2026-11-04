"use client"

import { useTranslations } from "next-intl"
import { Link } from "src/i18n/navigation"
import { cn } from "@/lib/utils"

export default function StatisticsHeader({
  active,
}: {
  active: "overview" | "permissions"
}) {
  const t = useTranslations()
  const pages = [
    {
      id: "overview",
      href: "/statistics",
      label: t("permission-statistics.overview"),
    },
    {
      id: "permissions",
      href: "/statistics/permissions",
      label: t("permission-statistics.title"),
    },
  ] as const

  return (
    <header className="flex flex-col gap-5">
      <h1 className="text-4xl font-extrabold tracking-tight">
        {t("statistics")}
      </h1>
      <nav aria-label={t("statistics")} className="border-b border-border">
        <ul className="flex flex-wrap gap-x-6 sm:gap-x-8">
          {pages.map((page) => (
            <li key={page.id}>
              <Link
                href={page.href}
                aria-current={active === page.id ? "page" : undefined}
                className={cn(
                  "-mb-px flex min-h-12 items-center border-b-2 px-1 py-3 text-sm font-semibold transition-colors focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 motion-reduce:transition-none sm:text-base",
                  active === page.id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground",
                )}
              >
                {page.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
