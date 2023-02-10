import { FunctionComponent, useRef, useState } from "react"
import React from "react"

import { HiCheckBadge } from "react-icons/hi2"
import { useTranslation } from "next-i18next"
import { VerificationStatus } from "src/types/VerificationStatus"
import {
  useFloating,
  useHover,
  useInteractions,
  arrow,
  offset,
  shift,
  autoPlacement,
} from "@floating-ui/react-dom-interactions"

interface Props {
  verificationStatus: VerificationStatus
}

const Verification: FunctionComponent<Props> = ({ verificationStatus }) => {
  const { t } = useTranslation()

  const arrowRef = useRef(null)
  const [open, setOpen] = useState(false)
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
    open,
    onOpenChange: setOpen,
    middleware: [
      shift(),
      autoPlacement(),
      offset(6),
      arrow({ element: arrowRef }),
    ],
  })
  const hover = useHover(context, {})

  const { getReferenceProps, getFloatingProps } = useInteractions([hover])

  const staticSide = {
    top: "bottom",
    right: "left",
    bottom: "top",
    left: "right",
  }[placement.split("-")[0]]

  if (verificationStatus?.verified == true) {
    return (
      <>
        <div className="text-sm text-blue-700 text-textSecondary md:text-start">
          {
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
          <button ref={reference} {...getReferenceProps}>
            <HiCheckBadge
              className="h-6 w-6 text-colorLink"
              aria-label={t("app-is-verified")}
            />
          </button>
        </div>
        {open && (
          <div
            ref={floating}
            style={{
              position: strategy,
              top: y ?? 0,
              left: x ?? 0,
            }}
            className="w-max rounded-xl bg-bgColorSecondary p-4"
            {...getFloatingProps()}
          >
            {
              verificationStatus.method == "manual"
                ? t("verified-manually-tooltip")
                : verificationStatus.method == "website"
                ? t("verified-website-tooltip", {
                    website: verificationStatus.website,
                  })
                : verificationStatus.method == "login_provider"
                ? t("verified-login-providert-tooltip", {
                    login_provider: verificationStatus.login_provider,
                    login_name: verificationStatus.login_name,
                  })
                : t("verified") // Should never happen
            }

            <div
              ref={arrowRef}
              className="absolute h-4 w-4 rotate-45 bg-bgColorSecondary"
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
      </>
    )
  } else {
    return null
  }
}
export default Verification
