import { FunctionComponent } from "react"
import Link from "next/link"
import LogoImage from "../LogoImage"

import { AppstreamListItem } from "../../types/Appstream"
import { clsx } from "clsx"
import { HiCheckBadge } from "react-icons/hi2"
import { useTranslation } from "next-i18next"
import { VerificationText } from "src/verification"
import { VerificationStatus } from "src/types/VerificationStatus"
import { VerificationProvider } from "src/verificationProvider"

interface Props {
  application: AppstreamListItem
}

const ApplicationCard: FunctionComponent<Props> = ({ application }) => {
  const { t } = useTranslation()

  const isVerified =
    application.metadata?.["flathub::verification::verified"] === "true"

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
      href={`/apps/${application.id}`}
      passHref
      className={clsx(
        "flex min-w-0 items-center gap-4 rounded-xl bg-flathub-white p-4 shadow-md duration-500 dark:bg-flathub-arsenic/70",
        "hover:cursor-pointer hover:bg-flathub-gainsborow/20 hover:no-underline hover:shadow-xl dark:hover:bg-flathub-arsenic/90",
        "active:bg-flathub-gainsborow/40 active:shadow-sm active:dark:bg-flathub-arsenic",
      )}
    >
      <div className="relative flex h-[64px] w-[64px] flex-shrink-0 flex-wrap items-center justify-center drop-shadow-md md:h-[128px] md:w-[128px]">
        <LogoImage iconUrl={application.icon} appName={application.name} />
      </div>
      <div className="flex flex-col justify-center overflow-hidden">
        <div className="flex">
          <h4 className="truncate whitespace-nowrap text-base font-semibold text-flathub-dark-gunmetal dark:text-flathub-gainsborow">
            {application.name}
          </h4>
        </div>
        <div className="mt-2 line-clamp-2 text-sm text-flathub-dark-gunmetal dark:text-flathub-gainsborow md:line-clamp-3">
          {application.summary}
        </div>
        {application.metadata?.["flathub::verification::verified"] && (
          <div className="mt-1 flex items-center text-xs font-semibold">
            <HiCheckBadge
              className="h-5 w-5 text-flathub-celestial-blue"
              title={t("app-is-verified")}
              aria-hidden={true}
            />
            <span aria-label={t("app-is-verified")}>
              {VerificationText(verificationStatus)}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}

export default ApplicationCard
