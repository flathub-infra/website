"use client"

import { useTranslations } from "next-intl"
import { Link } from "src/i18n/navigation"
import clsx from "clsx"
import { Sparkles } from "lucide-react"

export function YearInReviewBanner() {
  const t = useTranslations()

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentDay = now.getDate()
  const currentYear = now.getFullYear()

  const isLateDecember = currentMonth === 11 && currentDay >= 15
  const isEarlyJanuary = currentMonth === 0 && currentDay <= 15

  if (!isLateDecember && !isEarlyJanuary) {
    return null
  }

  const reviewYear = isLateDecember ? currentYear : currentYear - 1

  return (
    <Link
      href={`/year-in-review/${reviewYear}`}
      className={clsx(
        "flex items-center gap-3",
        "rounded-xl p-4 sm:py-5 sm:px-6",
        "bg-gradient-to-r from-[#4158D0] via-[#C850C0] to-[#FFCC70]",
        "text-white",
        "shadow-lg",
        "transition-all duration-300",
        "hover:shadow-xl hover:scale-[1.01] hover:brightness-110",
      )}
    >
      <Sparkles className="size-6 sm:size-8 flex-shrink-0" />
      <div>
        <h2 className="text-base sm:text-xl font-bold">
          {t("year-in-review-banner.title", { year: reviewYear })}
        </h2>
        <div className="text-sm sm:text-base text-white/90 hidden sm:block">
          {t("year-in-review-banner.description")}
        </div>
      </div>
    </Link>
  )
}
