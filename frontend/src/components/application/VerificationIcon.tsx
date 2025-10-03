import { FunctionComponent } from "react"
import React from "react"

import { CheckBadgeIcon } from "@heroicons/react/20/solid"
import { VerificationStatus } from "src/types/VerificationStatus"
import { verificationProviderToHumanReadable } from "src/verificationProvider"
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

const VerificationIcon: FunctionComponent<Props> = ({
  appId,
  verificationStatus,
}) => {
  const t = useTranslations()

  if (verificationStatus?.verified == true) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label={t("app-is-verified")}
              className="size-6 flex justify-center items-center"
            >
              <CheckBadgeIcon
                className="size-5 text-flathub-celestial-blue"
                aria-label={t("app-is-verified")}
              />
            </button>
          </TooltipTrigger>

          <TooltipContent side="right" className="max-w-xs">
            {verificationStatus.method === "manual"
              ? t.rich("verified-manually-tooltip", {
                  appid: (chunks) => <b>{appId}</b>,
                })
              : verificationStatus.method === "website"
                ? t.rich("verified-website-tooltip", {
                    appid: (chunks) => <b>{appId}</b>,
                    website: (chunks) => <b>{verificationStatus.website}</b>,
                  })
                : verificationStatus.method === "login_provider"
                  ? t.rich("verified-login-provider-tooltip", {
                      appid: (chunks) => <b>{appId}</b>,
                      loginname: (chunks) => (
                        <b>{verificationStatus.login_name}</b>
                      ),
                      loginprovider: (chunks) => (
                        <b>
                          {verificationProviderToHumanReadable(
                            verificationStatus.login_provider,
                          )}
                        </b>
                      ),
                    })
                  : t("verified")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  } else {
    return null
  }
}
export default VerificationIcon
