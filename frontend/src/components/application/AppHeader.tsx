import { useTranslation } from "next-i18next"
import React from "react"
import { Appstream } from "src/types/Appstream"
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
    <header className="col-start-2 flex w-full flex-col gap-4 py-7 sm:flex-row">
      {app.icon && (
        <div className="relative m-2 flex h-[128px] min-w-[128px] self-center drop-shadow-md">
          <LogoImage iconUrl={app.icon} appName={app.name} />
        </div>
      )}

      <div className="mx-3 my-auto">
        <div className="mb-2 flex items-center justify-center space-x-3 sm:justify-start">
          <h2 className="my-0">{app.name}</h2>
        </div>
        {app.developer_name?.trim().length > 0 && (
          <div className="text-center text-sm font-light text-flathubNickel dark:text-flathubDarkGray sm:text-start">
            {t("by", {
              developer: app.developer_name,
            })}
          </div>
        )}
        <Verification
          appId={app.id}
          verificationStatus={verificationStatus}
        ></Verification>
      </div>

      <div className="flex items-center justify-center gap-4 sm:ml-auto">
        <Button className="w-52 sm:w-32 md:w-40" onClick={installClicked}>
          {t("install")}
        </Button>
        {app.urls?.donation && (
          <ButtonLink
            href={app.urls.donation}
            target="_blank"
            rel="noreferrer"
            onClick={donateClicked}
            passHref
            className="w-52 sm:w-32 md:w-40"
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
