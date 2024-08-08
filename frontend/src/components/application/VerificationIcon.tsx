import { FunctionComponent, useState } from "react"
import React from "react"

import { HiMiniCheckBadge } from "react-icons/hi2"
import { Trans, useTranslation } from "next-i18next"
import { VerificationStatus } from "src/types/VerificationStatus"
import {
  useFloating,
  useHover,
  useInteractions,
  offset,
  shift,
  autoPlacement,
  useRole,
  useDismiss,
  useFocus,
} from "@floating-ui/react"
import { verificationProviderToHumanReadable } from "src/verificationProvider"
import { clsx } from "clsx"

interface Props {
  appId: string
  verificationStatus: VerificationStatus
}

const VerificationIcon: FunctionComponent<Props> = ({
  appId,
  verificationStatus,
}) => {
  const { t } = useTranslation()

  const [isOpen, setIsOpen] = useState(false)
  const { x, y, refs, strategy, context, placement } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [shift(), autoPlacement(), offset(6)],
  })
  const hover = useHover(context, { move: false })
  const focus = useFocus(context)
  const dismiss = useDismiss(context)
  const role = useRole(context, { role: "tooltip" })

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ])

  if (verificationStatus?.verified == true) {
    return (
      <>
        <button
          ref={refs.setReference}
          {...getReferenceProps}
          aria-label={t("app-is-verified")}
          className="size-6 flex justify-center items-center"
        >
          <HiMiniCheckBadge
            className="size-5 text-flathub-celestial-blue"
            aria-label={t("app-is-verified")}
          />
        </button>

        {isOpen && (
          <div
            ref={refs.setFloating}
            style={{
              position: strategy,
              top: y ?? 0,
              left: x ?? 0,
            }}
            className={clsx(
              "text-xs font-semibold",
              "z-40 mx-1 max-w-xs rounded-xl p-3",
              "drop-shadow",
              "bg-flathub-white dark:bg-flathub-granite-gray dark:text-flathub-gainsborow text-flathub-arsenic",
            )}
            {...getFloatingProps()}
          >
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
          </div>
        )}
      </>
    )
  } else {
    return null
  }
}
export default VerificationIcon
