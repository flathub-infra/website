import { FunctionComponent } from "react"
import Link from "next/link"
import LogoImage from "../LogoImage"

import { AppstreamListItem } from "../../types/Appstream"

interface Props {
  application: AppstreamListItem
}

const ApplicationCard: FunctionComponent<Props> = ({ application }) => (
  <Link
    href={`/apps/details/${application.id}`}
    passHref
    className="flex h-[160px] min-w-0 gap-4 rounded-xl bg-bgColorSecondary p-4 shadow-md duration-500 hover:cursor-pointer hover:no-underline hover:shadow-xl hover:brightness-95 active:bg-bgColorPrimary"
  >
    <div className="flex h-[128px] flex-shrink-0 flex-wrap items-center justify-center drop-shadow-md">
      <LogoImage iconUrl={application.icon} appName={application.name} />
    </div>
    <div className="flex flex-col justify-center overflow-hidden">
      <h4 className="flex-shrink-0 truncate whitespace-nowrap font-semibold text-textPrimary">
        {application.name}
      </h4>
      <div className="text-sm text-textPrimary line-clamp-3">
        {application.summary}
      </div>
    </div>
  </Link>
)

export default ApplicationCard
