import { useTranslation } from "next-i18next"
import React from "react"
import { Appstream } from "src/types/Appstream"
import { VendingSetup } from "src/types/Vending"
import { VerificationStatus } from "src/types/VerificationStatus"
import ButtonLink from "../ButtonLink"
import LogoImage from "../LogoImage"
import Verification from "./Verification"
import { useMatomo } from "@mitresthen/matomo-tracker-react"
import InstallButton from "../application/InstallButton"

export function AppHeader({
  app,
  vendingSetup,
  verificationStatus,
}: {
  app: Appstream
  vendingSetup: VendingSetup
  verificationStatus: VerificationStatus
}) {
  const { t } = useTranslation()
  const { trackEvent } = useMatomo()

  const donateClicked = (e) => {
    e.preventDefault()
    trackEvent({ category: "App", action: "Donate", name: app.id })
    window.location.href = app.urls.donation
  }

  return (
    <header className="col-start-2 flex w-full flex-col gap-4 py-7 sm:flex-row">
      {app.icon && (
        <div className="relative m-2 flex h-[128px] min-w-[128px] self-center drop-shadow-md">
          <LogoImage iconUrl={app.icon} appName={app.name} />
        </div>
      )}

      <div className="mx-3 my-auto">
        <div className="mb-2 flex items-center justify-center space-x-3 sm:justify-start">
          <h1 className="my-0 text-center text-4xl font-extrabold sm:text-start">
            {app.name}
          </h1>
        </div>
        {app.developer_name?.trim().length > 0 && (
          <div className="text-center text-sm font-light text-flathub-sonic-silver dark:text-flathub-spanish-gray sm:text-start">
            {t("by", {
              developer: app.developer_name,
            })}
          </div>
        )}
        <Verification appId={app.id} verificationStatus={verificationStatus} />
      </div>

      <div className="flex items-center justify-center gap-4 sm:ms-auto">
        <InstallButton appId={app.id} />
        {app.urls?.donation && (
          <ButtonLink
            href={app.urls.donation}
            target="_blank"
            rel="noreferrer"
            onClick={donateClicked}
            passHref
            className="w-52 basis-1/2 sm:w-32 md:w-40"
            variant="secondary"
          >
            {t("donate")}
          </ButtonLink>
        )}
        {!!vendingSetup?.recommended_donation && (
          <ButtonLink
            passHref
            href={`/apps/purchase/${app.id}`}
            className="w-52 sm:w-32 md:w-40"
          >
            {t("kind-purchase")}
          </ButtonLink>
        )}
      </div>
    </header>
  )
}
