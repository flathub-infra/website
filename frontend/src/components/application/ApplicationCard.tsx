import { FunctionComponent } from "react"
import Link from "next/link"
import LogoImage from "../LogoImage"

import { AppstreamListItem } from "../../types/Appstream"

interface Props {
  application: AppstreamListItem
}

const ApplicationCard: FunctionComponent<Props> = ({ application }) => (
  <Link
    href={`/apps/${application.id}`}
    passHref
    className="flex min-w-0 items-center gap-4 rounded-xl bg-flathubWhite p-4 shadow-md duration-500 hover:cursor-pointer hover:no-underline hover:shadow-xl hover:brightness-95 active:bg-flathubGray98 dark:bg-flathubJet active:dark:bg-flathubRaisinBlack"
  >
    <div className="relative h-[64px] w-[64px] flex-shrink-0 flex-wrap items-center justify-center drop-shadow-md md:h-[128px] md:w-[128px]">
      <LogoImage iconUrl={application.icon} appName={application.name} />
    </div>
    <div className="flex flex-col justify-center overflow-hidden">
      <h4 className="flex-shrink-0 truncate whitespace-nowrap font-semibold text-flathubGunmetal dark:text-flathubGray98">
        {application.name}
      </h4>
      <div className="text-sm text-flathubGunmetal line-clamp-3 dark:text-flathubGray98">
        {application.summary}
      </div>
    </div>
  </Link>
)

export default ApplicationCard
