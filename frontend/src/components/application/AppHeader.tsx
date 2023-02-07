import { useTranslation } from "next-i18next"
import React from "react"
import { Appstream } from "src/types/Appstream"
import { UserState } from "src/types/Login"
import { VendingSetup } from "src/types/Vending"
import { VerificationStatus } from "src/types/VerificationStatus"
import Button from "../Button"
import ButtonLink from "../ButtonLink"
import LogoImage from "../LogoImage"
import Verification from "./Verification"

export function AppHeader({
  app,
  installClicked,
  donateClicked,
  vendingSetup,
  verificationStatus,
}: {
  app: Appstream
  installClicked: (e: any) => void
  donateClicked: (e: any) => void
  vendingSetup: VendingSetup
  verificationStatus: VerificationStatus
}) {
  const { t } = useTranslation()

  return (
    <header className="col-start-2 flex w-full flex-col gap-4 py-7 md:flex-row">
      {app.icon && (
        <div className="relative m-2 flex h-[128px] w-[128px] self-center drop-shadow-md">
          <LogoImage iconUrl={app.icon} appName={app.name} />
        </div>
      )}

      <div className="mx-3 my-auto">
        <div className="mb-2 flex space-x-3">
          <h2 className="my-0">{app.name}</h2>
          <Verification verificationStatus={verificationStatus}></Verification>
        </div>
        {app.developer_name?.trim().length > 0 && (
          <div className="text-sm font-light text-textSecondary">
            {t("by", {
              developer: app.developer_name,
            })}
          </div>
        )}
      </div>

      <div className="grid items-center gap-4 sm:grid-cols-2 md:ml-auto">
        <Button className="w-full" onClick={installClicked}>
          {t("install")}
        </Button>
        {app.urls?.donation && (
          <ButtonLink
            href={app.urls.donation}
            target="_blank"
            rel="noreferrer"
            onClick={donateClicked}
            passHref
            className="w-full"
            variant="secondary"
          >
            {t("donate")}
          </ButtonLink>
        )}
        {!!vendingSetup?.recommended_donation && (
          <ButtonLink
            passHref
            href={`/apps/purchase/${app.id}`}
            className="w-full"
          >
            {t("kind-purchase")}
          </ButtonLink>
        )}
      </div>
    </header>
  )
}
