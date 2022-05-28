import { FunctionComponent } from "react"
import Link from "next/link"
import LogoImage from "../LogoImage"

import { Appstream } from "../../types/Appstream"

interface Props {
  application: Appstream
}

const ApplicationCard: FunctionComponent<Props> = ({ application }) => (
  <Link href={`/apps/details/${application.id}`} passHref>
    <a className="flex min-w-0 flex-col rounded-xl bg-bgColorSecondary shadow-md duration-500 hover:cursor-pointer hover:no-underline hover:shadow-xl hover:brightness-95 active:bg-bgColorPrimary">
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
    </a>
  </Link>
)

export default ApplicationCard
