import clsx from "clsx"
import Link from "next/link"
import { DesktopAppstream } from "src/types/Appstream"

import LogoImage from "../LogoImage"
import { HiStar } from "react-icons/hi2"
import { useTranslation } from "next-i18next"

export const AppOfTheDay = ({
  appOfTheDay: appOfTheDay,
}: {
  appOfTheDay: DesktopAppstream
}) => {
  const { t } = useTranslation()

  return (
    <Link
      href={`/apps/${appOfTheDay.id}`}
      passHref
      className={clsx(
        "bg-flathub-white dark:bg-flathub-arsenic rounded-xl",
        "flex min-w-0 items-center gap-4 p-8 pb-0 duration-500",
        "hover:cursor-pointer hover:bg-flathub-gainsborow/20 hover:no-underline dark:hover:bg-flathub-arsenic/90",
        "active:bg-flathub-gainsborow/40 active:dark:bg-flathub-arsenic",
        "h-full",
        "shadow-md",
        "flex flex-col",
        "text-flathub-dark-gunmetal dark:text-flathub-gainsborow",
      )}
    >
      <div className="flex w-full h-full">
        <div className="w-1/2 pb-8">
          <div className="flex gap-1 items-center">
            <HiStar className="text-flathub-dark-gunmetal dark:text-flathub-gainsborow" />
            {t("app-of-the-day")}
          </div>
          <div className="flex flex-col gap-2 pt-8">
            <span className="text-2xl font-extrabold">{appOfTheDay.name}</span>
            <span>{appOfTheDay.summary}</span>
          </div>
        </div>
        <div className="w-1/2 relative justify-center flex overflow-hidden">
          <div className="absolute drop-shadow-md">
            <LogoImage
              size="128"
              iconUrl={appOfTheDay.icon}
              appName={appOfTheDay.name}
            />
          </div>
        </div>
      </div>
    </Link>
  )
}
