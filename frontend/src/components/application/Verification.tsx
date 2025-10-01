import { FunctionComponent } from "react"
import React from "react"

import { VerificationStatus } from "src/types/VerificationStatus"
import { VerificationText } from "src/verification"
import VerificationIcon from "./VerificationIcon"
import { HiInformationCircle } from "react-icons/hi2"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useTranslations } from "next-intl"

interface Props {
  appId: string
  verificationStatus: VerificationStatus
}

const Verification: FunctionComponent<Props> = ({
  appId,
  verificationStatus,
}) => {
  const t = useTranslations()
  const verificationText = VerificationText(verificationStatus)
  let verifiedLink = null

  switch (verificationStatus.method) {
    case "manual":
      verifiedLink = verificationText
      break

    case "website":
      verifiedLink = (
        <a
          className="no-underline hover:underline"
          href={`https://${verificationStatus.website}`}
          target="_blank"
          rel="noreferrer"
        >
          {verificationText}
        </a>
      )
      break

    case "login_provider":
      let link: string
      switch (verificationStatus.login_provider) {
        case "github":
          link = `https://github.com/${verificationStatus.login_name}`
          break
        case "gitlab":
          link = `https://gitlab.com/${verificationStatus.login_name}`
          break
        case "gnome":
          link = `https://gitlab.gnome.org/${verificationStatus.login_name}`
          break
        case "kde":
          link = `https://invent.kde.org/${verificationStatus.login_name}`
          break
      }
      verifiedLink = (
        <a
          className="no-underline hover:underline"
          href={link}
          target="_blank"
          rel="noreferrer"
        >
          {verificationText}
        </a>
      )
      break
  }

  return verificationStatus?.verified == true ? (
    <div className="flex pt-1 items-center justify-center text-xs font-semibold text-flathub-celestial-blue sm:justify-start">
      <VerificationIcon appId={appId} verificationStatus={verificationStatus} />
      {verifiedLink}
    </div>
  ) : (
    <div className="flex pt-1 items-center justify-center sm:justify-start">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="rounded-full w-fit text-flathub-black dark:text-flathub-white bg-flathub-status-yellow-dark dark:bg-flathub-status-yellow py-0.5 px-2 cursor-pointer">
              <div className="text-xs flex gap-1 items-center">
                <HiInformationCircle className="size-3.5" />
                {t("unverified")}
              </div>
            </div>
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
