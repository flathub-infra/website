import { FunctionComponent } from "react"
import React from "react"

import { HiCheckBadge } from "react-icons/hi2"
import { useTranslation } from "next-i18next"
import { VerificationStatus } from "src/types/VerificationStatus"

interface Props {
  verificationStatus: VerificationStatus
}

const Verification: FunctionComponent<Props> = ({ verificationStatus }) => {
  const { t } = useTranslation()

  if (verificationStatus?.verified == true) {
    return (
      <HiCheckBadge
        className="h-10 w-10 text-colorPrimary"
        title={
          verificationStatus.method == "manual"
            ? t("verified-manually")
            : verificationStatus.method == "website"
            ? t("verified-website", {
                website: verificationStatus.website,
              })
            : verificationStatus.method == "login_provider"
            ? t("verified-login-provider", {
                login_provider: verificationStatus.login_provider,
                login_name: verificationStatus.login_name,
              })
            : t("verified") // Should never happen
        }
        aria-label={t("app-is-verified")}
      />
    )
  } else {
    return null
  }
}
export default Verification
