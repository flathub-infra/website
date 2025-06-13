import Link from "next/link"
import { DesktopAppstream } from "src/types/Appstream"

import LogoImage from "../LogoImage"
import { HiMiniStar } from "react-icons/hi2"
import { useTranslation } from "next-i18next"
import { useTheme } from "next-themes"
import { chooseBrandingColor, getContrastColor } from "@/lib/helpers"
import { cn } from "@/lib/utils"
import clsx from "clsx"
import { useEffect, useState } from "react"

export const AppOfTheDay = ({
  appOfTheDay,
  className,
}: {
  appOfTheDay: Pick<
    DesktopAppstream,
    "id" | "name" | "branding" | "summary" | "icon"
  >
  className?: string
}) => {
  const { t } = useTranslation()
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!appOfTheDay) {
    return null
  }

  const fallbackColor = chooseBrandingColor(appOfTheDay.branding, "dark")

  const brandingColor = chooseBrandingColor(
    appOfTheDay.branding,
    resolvedTheme as "light" | "dark",
  )

  const textColor = mounted
    ? getContrastColor(brandingColor.value) === "black"
      ? "text-flathub-dark-gunmetal"
      : "text-flathub-lotion"
    : "text-flathub-dark-gunmetal dark:text-flathub-lotion"

  return (
    <Link
      href={`/apps/${appOfTheDay.id}`}
      passHref
      style={{
        backgroundColor:
          (mounted ? brandingColor.value : fallbackColor.value) ?? "#FF00DC",
      }}
      className={cn(
        "rounded-xl",
        "flex min-w-0 items-center gap-4 p-8 pb-0 duration-500",
        "hover:cursor-pointer",
        "shadow-md",
        textColor,
        className,
      )}
    >
      <div className="grid grid-cols-2 grid-rows-[auto_1fr] w-full h-full">
        <div className="flex gap-1 col-span-2 items-center col-start-1 row-start-1">
          <HiMiniStar className={clsx(textColor, "size-4 shrink-0")} />
          {t("app-of-the-day")}
        </div>
        <div className="flex flex-col gap-2 py-8 col-start-1 row-start-2">
          <span className="text-2xl break-words font-extrabold">
            {appOfTheDay.name}
          </span>
          <span className={clsx("line-clamp-2 text-sm", "lg:line-clamp-3")}>
            {appOfTheDay.summary}
          </span>
        </div>
        <div className="pb-8 col-start-2 row-start-1 row-span-2 relative items-center sm:items-start justify-center flex overflow-hidden">
          <div className="absolute drop-shadow-md">
            <LogoImage
              size="128"
              priority
              quality={100}
              iconUrl={appOfTheDay.icon}
              appName={appOfTheDay.name}
            />
          </div>
        </div>
      </div>
    </Link>
  )
}
