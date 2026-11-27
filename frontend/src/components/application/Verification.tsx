import { FunctionComponent } from "react"
import React from "react"

import { VerificationText } from "src/verification"
import VerificationIcon from "./VerificationIcon"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useTranslations } from "next-intl"
import { InfoIcon } from "lucide-react"
import { clsx } from "clsx"
import { GetVerificationStatusVerificationAppIdStatusGet200 } from "src/codegen"

interface Props {
  appId: string
  developerName?: string
  verificationStatus: GetVerificationStatusVerificationAppIdStatusGet200
}

const Verification: FunctionComponent<Props> = ({
  appId,
  developerName,
  verificationStatus,
}) => {
  const t = useTranslations()
  const fallbackText = VerificationText(verificationStatus)
  const verificationText = developerName || fallbackText
  let href: string | undefined
  if (verificationStatus.method === "website") {
    href = `https://${verificationStatus.website}`
  } else if (verificationStatus.method === "login_provider") {
    const hosts = {
      github: "github.com",
      gitlab: "gitlab.com",
      gnome: "gitlab.gnome.org",
      kde: "invent.kde.org",
    }
    const host = hosts[verificationStatus.login_provider]
    if (host) {
      href = `https://${host}/${verificationStatus.login_name}`
    }
  }

  return verificationStatus?.verified == true ? (
    <div className="min-w-0 text-center text-sm font-semibold text-flathub-celestial-blue-dark [overflow-wrap:anywhere] dark:text-flathub-celestial-blue-light sm:text-start">
      {href ? (
        <a
          className="text-inherit no-underline hover:underline"
          href={href}
          target="_blank"
          rel="noreferrer"
        >
          {verificationText}
        </a>
      ) : (
        verificationText
      )}
      {"\u00a0"}
      <VerificationIcon appId={appId} verificationStatus={verificationStatus} />
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 sm:justify-start">
      {developerName && (
        <span className="min-w-0 text-center text-sm text-flathub-granite-gray [overflow-wrap:anywhere] dark:text-flathub-spanish-gray sm:text-start">
          {t("developed-by", { developer: developerName })}
        </span>
      )}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild keepOpenOnTouch>
            <button
              type="button"
              className={clsx(
                "rounded-full w-fit",
                "text-flathub-black dark:text-flathub-white",
                "bg-flathub-status-yellow-dark dark:bg-flathub-status-yellow",
                "py-0.5 ps-1 pe-2 cursor-pointer",
              )}
            >
              <span className="text-xs flex gap-1 items-center">
                <InfoIcon className="size-3.5" />
                {t("unverified")}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            {t.rich("unverified-tooltip", {
              appid: (chunks) => <b>{appId}</b>,
            })}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
export default Verification
