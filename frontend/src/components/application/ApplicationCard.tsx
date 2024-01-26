import { FunctionComponent } from "react"
import Link from "next/link"
import LogoImage from "../LogoImage"

import { AppstreamListItem } from "../../types/Appstream"
import { clsx } from "clsx"
import { VerificationStatus } from "src/types/VerificationStatus"
import { VerificationProvider } from "src/verificationProvider"
import VerificationIcon from "./VerificationIcon"
import AppRating from "./AppRating"

interface Props {
  application: AppstreamListItem
  link?: (appid: string) => string
  inACard?: boolean
  showId?: boolean
}

const ApplicationCard: FunctionComponent<Props> = ({
  application,
  link,
  inACard,
  showId = false,
}) => {
  const isVerified =
    application.metadata?.["flathub::verification::verified"] === "true"

  const linkFunc = link ?? ((appid: string) => `/apps/${appid}`)

  const verificationStatus: VerificationStatus = isVerified
    ? {
        method: application.metadata?.["flathub::verification::method"],
        verified: true,
        website: application.metadata?.["flathub::verification::website"],
        login_provider: application.metadata?.[
          "flathub::verification::login_provider"
        ] as VerificationProvider,
        login_name: application.metadata?.["flathub::verification::login_name"],
        login_is_organization:
          application.metadata?.[
            "flathub::verification::login_is_organization"
          ] === "true",
        timestamp: 0,
        detail: "",
      }
    : {
        method: "none",
        verified: false,
        detail: "",
      }

  return (
    <Link
      href={linkFunc(application.id)}
      passHref
      className={clsx(
        inACard
          ? "bg-flathub-gainsborow/40 dark:bg-flathub-gainsborow/10 rounded-lg shadow-md hover:bg-flathub-gainsborow/20 dark:hover:bg-flathub-gainsborow/20"
          : "bg-flathub-white dark:bg-flathub-arsenic rounded-xl shadow-md hover:bg-flathub-gainsborow/20 dark:hover:bg-flathub-arsenic/90",
        "flex min-w-0 items-center gap-4 p-4 duration-500",
        "hover:cursor-pointer hover:no-underline",
        "active:bg-flathub-gainsborow/40 active:dark:bg-flathub-arsenic",
        "h-full",
      )}
    >
      <div className="relative flex h-[64px] w-[64px] flex-shrink-0 flex-wrap items-center justify-center drop-shadow-md md:h-[96px] md:w-[96px]">
        <LogoImage iconUrl={application.icon} appName={application.name} />
      </div>
      <div className="flex flex-col justify-center overflow-hidden">
        <div className="flex gap-1">
          <span className="truncate whitespace-nowrap text-base font-semibold text-flathub-dark-gunmetal dark:text-flathub-gainsborow">
            {application.name}
          </span>
          <VerificationIcon
            appId={application.id}
            verificationStatus={verificationStatus}
          />
          {verificationStatus.verified &&
            application.metadata["flathub::rating"] > 0 && (
              <>
                <div className="bg-flathub-dark-gunmetal dark:bg-flathub-gainsborow h-1 w-1 mx-1 self-center rounded-full"></div>
                <div className="flex flex-row items-center text-sm">
                  <AppRating
                    rating={application.metadata["flathub::rating"]}
                  ></AppRating>
                </div>
              </>
            )}
        </div>
        {showId && application.id !== application.name && (
          <div className="text-sm text-flathub-spanish-gray truncate leading-none">
            {application.id}
          </div>
        )}
        <div className="mt-1 line-clamp-2 text-sm text-flathub-dark-gunmetal dark:text-flathub-gainsborow md:line-clamp-3">
          {application.summary}
        </div>
      </div>
    </Link>
  )
}

export default ApplicationCard
