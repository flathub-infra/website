import { FunctionComponent } from "react"
import Link from "next/link"
import LogoImage from "../LogoImage"

import { AppstreamListItem } from "../../types/Appstream"
import { classNames } from "src/styling"

interface Props {
  application: AppstreamListItem
}

const ApplicationCard: FunctionComponent<Props> = ({ application }) => (
  <Link
    href={`/apps/${application.id}`}
    passHref
    className={classNames(
      "flex min-w-0 items-center gap-4 rounded-xl bg-flathub-white p-4 shadow-md duration-500 dark:bg-flathub-arsenic",
      "hover:cursor-pointer hover:bg-flathub-gainsborow/5 hover:no-underline hover:shadow-xl dark:hover:bg-flathub-granite-gray",
      "active:bg-flathub-gray-x11 active:dark:bg-flathub-dark-gunmetal",
    )}
  >
    <div className="relative h-[64px] w-[64px] flex-shrink-0 flex-wrap items-center justify-center drop-shadow-md md:h-[128px] md:w-[128px]">
      <LogoImage iconUrl={application.icon} appName={application.name} />
    </div>
    <div className="flex flex-col justify-center overflow-hidden">
      <h4 className="flex-shrink-0 truncate whitespace-nowrap font-semibold text-flathub-dark-gunmetal dark:text-flathub-gainsborow">
        {application.name}
      </h4>
      <div className="text-sm text-flathub-dark-gunmetal line-clamp-3 dark:text-flathub-gainsborow">
        {application.summary}
      </div>
    </div>
  </Link>
)

export default ApplicationCard
