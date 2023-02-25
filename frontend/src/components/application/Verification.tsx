import { FunctionComponent, useRef, useState } from "react"
import React from "react"

import { HiCheckBadge } from "react-icons/hi2"
import { Trans, useTranslation } from "next-i18next"
import { VerificationStatus } from "src/types/VerificationStatus"
import {
  useFloating,
  useHover,
  useInteractions,
  arrow,
  offset,
  shift,
  autoPlacement,
  useRole,
  useDismiss,
  useFocus,
} from "@floating-ui/react-dom-interactions"
import { verificationProviderToHumanReadable } from "src/verificationProvider"

interface Props {
  appId: string
  verificationStatus: VerificationStatus
}

const Verification: FunctionComponent<Props> = ({
  appId,
  verificationStatus,
}) => {
  const { t } = useTranslation()

  const arrowRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const {
    x,
    y,
    reference,
    floating,
    strategy,
    context,
    middlewareData: { arrow: { x: arrowX, y: arrowY } = {} },
    placement,
  } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      shift(),
      autoPlacement(),
      offset(6),
      arrow({ element: arrowRef }),
    ],
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

  const staticSide = {
    top: "bottom",
    right: "left",
    bottom: "top",
    left: "right",
  }[placement.split("-")[0]]

  let verifiedLink = null

  switch (verificationStatus.method) {
    case "manual":
      verifiedLink = t("verified")
      break

    case "website":
      verifiedLink = (
        <a
          href={`https://${verificationStatus.website}`}
          target="_blank"
          rel="noreferrer"
        >
          {verificationStatus.website}
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
      }
      verifiedLink = (
        <a href={link} target="_blank" rel="noreferrer">
          {t("verified-login-provider", {
            login_provider: verificationProviderToHumanReadable(
              verificationStatus.login_provider,
            ),
            login_name: verificationStatus.login_name,
          })}
        </a>
      )
      break
  }

  if (verificationStatus?.verified == true) {
    return (
      <div className="flex items-center justify-center gap-1 text-sm text-flathub-sonic-silver dark:text-flathub-spanish-gray sm:justify-start">
        {verifiedLink}
        <button ref={reference} {...getReferenceProps}>
          <HiCheckBadge
            className="h-6 w-6 text-flathub-celestial-blue"
            aria-label={t("app-is-verified")}
          />
        </button>

        {isOpen && (
          <div
            ref={floating}
            style={{
              position: strategy,
              top: y ?? 0,
              left: x ?? 0,
            }}
            className="rounded-xl bg-flathub-gray-x11 p-4 dark:bg-flathub-granite-gray dark:text-flathub-gainsborow"
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
                    @
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

            <div
              ref={arrowRef}
              className="absolute h-4 w-4 rotate-45 bg-flathub-gray-x11 dark:bg-flathub-granite-gray"
              style={{
                top: arrowY != null ? `${arrowY}px` : "",
                left: arrowX != null ? `${arrowX}px` : "",
                right: "",
                bottom: "",
                [staticSide]: "-4px",
              }}
            />
          </div>
        )}
      </div>
    )
  } else {
    return null
  }
}
export default Verification
