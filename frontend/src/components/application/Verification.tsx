import { FunctionComponent } from "react"
import React from "react"

import { VerificationStatus } from "src/types/VerificationStatus"
import { VerificationText } from "src/verification"
import VerificationIcon from "./VerificationIcon"
import { HiMiniExclamationTriangle } from "react-icons/hi2"
import { useTranslation } from "react-i18next"

interface Props {
  appId: string
  verificationStatus: VerificationStatus
}

const Verification: FunctionComponent<Props> = ({
  appId,
  verificationStatus,
}) => {
  const { t } = useTranslation()
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

  if (verificationStatus?.verified == true) {
    return (
      <div className="flex items-center justify-center text-xs font-semibold text-flathub-celestial-blue sm:justify-start">
        <VerificationIcon
          appId={appId}
          verificationStatus={verificationStatus}
        />
        {verifiedLink}
      </div>
    )
  } else {
    return (
      <>
        <div className="rounded-full w-fit text-flathub-white bg-flathub-status-orange dark:bg-flathub-status-orange-dark py-0.5 px-2">
          <div className="text-xs flex gap-1 items-end">
            <HiMiniExclamationTriangle className="size-3.5" />
            {t("unverified")}
          </div>
        </div>
      </>
    )
  }
}
export default Verification
