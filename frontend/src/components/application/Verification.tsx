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
        title={t("verified")}
        aria-label={t("app-is-verified")}
      />
    )
  } else {
    return null
  }
}
export default Verification
