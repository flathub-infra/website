import { FunctionComponent } from "react"
import React from "react"

import { HiMiniCheckBadge } from "react-icons/hi2"
import { Trans, useTranslation } from "next-i18next"
import { VerificationStatus } from "src/types/VerificationStatus"
import { verificationProviderToHumanReadable } from "src/verificationProvider"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface Props {
  appId: string
  verificationStatus: VerificationStatus
}

const VerificationIcon: FunctionComponent<Props> = ({
  appId,
  verificationStatus,
}) => {
  const { t } = useTranslation()

  if (verificationStatus?.verified == true) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label={t("app-is-verified")}
              className="size-6 flex justify-center items-center"
            >
              <HiMiniCheckBadge
                className="size-5 text-flathub-celestial-blue"
                aria-label={t("app-is-verified")}
              />
            </button>
          </TooltipTrigger>

          <TooltipContent side="right" className="max-w-xs">
            {
              verificationStatus.method == "manual" ? (
                <Trans i18nKey={"verified-manually-tooltip"}>
                  The ownership of the <b>{{ app_id: appId }}</b> application ID
                  has been manually verified by Flathub staff
                </Trans>
              ) : verificationStatus.method == "website" ? (
                <Trans
                  i18nKey={"verified-website-tooltip"}
                  values={{
                    app_id: appId,
                    website: verificationStatus.website,
                  }}
                >
                  The ownership of the <b>{{ app_id: appId }}</b> application ID
                  has been verified by the owner of{" "}
                  <b>{{ website: verificationStatus.website }}</b>
                </Trans>
              ) : verificationStatus.method == "login_provider" ? (
                <Trans i18nKey={"verified-login-provider-tooltip"}>
                  The ownership of the <b>{{ app_id: appId }}</b> application ID
                  has been verified by{" "}
                  <b>
                    {{
                      login_provider: verificationProviderToHumanReadable(
                        verificationStatus.login_provider,
                      ),
                    }}
                  </b>{" "}
                  on{" "}
                  <b>
                    {{
                      login_name: verificationStatus.login_name,
                    }}
                  </b>
                </Trans>
              ) : (
                t("verified")
              ) // Should never happen
            }
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  } else {
    return null
  }
}
export default VerificationIcon
