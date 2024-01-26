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
      style={{ backgroundImage: `url(${appOfTheDay.icon})` }}
      className={clsx(
        "bg-[length:1px_1px]",
        "rounded-xl",
        "flex min-w-0 items-center gap-4 p-8 pb-0 duration-500",
        "hover:cursor-pointer",
        "shadow-md",
        "text-flathub-dark-gunmetal dark:text-flathub-gainsborow",
        "h-48",
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
