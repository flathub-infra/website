import { FunctionComponent } from "react"
import React from "react"

import { HiMiniCheckBadge } from "react-icons/hi2"
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
              <HiMiniCheckBadge
                className="size-5 text-flathub-celestial-blue"
                aria-label={t("app-is-verified")}
              />
            </button>
          </TooltipTrigger>

          <TooltipContent side="right" className="max-w-xs">
            {verificationStatus.method === "manual"
              ? t.rich("verified-manually-tooltip", {
                  app_id: appId,
                  appid: (chunks) => <b>{chunks}</b>,
                })
              : verificationStatus.method === "website"
                ? t.rich("verified-website-tooltip", {
                    app_id: appId,
                    appid: (chunks) => <b>{chunks}</b>,
                    website: (chunks) => <b>{verificationStatus.website}</b>,
                  })
                : verificationStatus.method === "login_provider"
                  ? t.rich("verified-login-provider-tooltip", {
                      app_id: appId,
                      login_name: verificationStatus.login_name,
                      login_provider: verificationProviderToHumanReadable(
                        verificationStatus.login_provider,
                      ),
                      appid: (chunks) => <b>{chunks}</b>,
                      loginname: (chunks) => <b>{chunks}</b>,
                      loginprovider: (chunks) => <b>{chunks}</b>,
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
