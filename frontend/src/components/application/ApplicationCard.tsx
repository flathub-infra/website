import { FunctionComponent } from "react"
import Link from "next/link"
import LogoImage from "../LogoImage"

import { AppstreamListItem } from "../../types/Appstream"

interface Props {
  application: Partial<AppstreamListItem>
}

function appLink(application: Partial<AppstreamListItem>) {
  /* If the app doesn't have appstream metadata (e.g. "name"), go straight
  to the developer page, because the store page doesn't exist yet */
  return "name" in application
    ? `/apps/details/${application.id}`
    : `/apps/manage/${application.id}`
}

const ApplicationCard: FunctionComponent<Props> = ({ application }) => (
  <Link
    href={appLink(application)}
    passHref
    className="flex min-w-0 flex-col rounded-xl bg-bgColorSecondary shadow-md duration-500 hover:cursor-pointer hover:no-underline hover:shadow-xl hover:brightness-95 active:bg-bgColorPrimary"
  >
    <div className="flex h-[168px] items-center justify-center drop-shadow-md">
      <LogoImage iconUrl={application.icon} appName={application.name} />
    </div>
    <div className="flex h-16 w-full flex-col justify-center px-4 pt-0 pb-1 text-center">
      <h4 className="m-0 overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-textPrimary">
        {application.name}
      </h4>
      <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-textPrimary">
        {application.summary}
      </p>
    </div>
  </Link>
)

export default ApplicationCard
