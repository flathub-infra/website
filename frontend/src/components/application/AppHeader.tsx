import { useTranslation } from "next-i18next"
import Link from "next/link"
import React from "react"
import { Appstream } from "src/types/Appstream"
import { UserState } from "src/types/Login"
import { VendingSetup } from "src/types/Vending"
import Button from "../Button"
import LogoImage from "../LogoImage"

export function AppHeader({
  app,
  user,
  installClicked,
  donateClicked,
  vendingSetup,
}: {
  app: Appstream
  user: UserState
  installClicked: (e: any) => void
  donateClicked: (e: any) => void
  vendingSetup: VendingSetup
}) {
  const { t } = useTranslation()

  return (
    <header className="col-start-2 flex w-full flex-col gap-8 py-7 md:flex-row">
      {app.icon && (
        <div className="m-2 flex max-h-[128px] max-w-[128px] self-center drop-shadow-md">
          <LogoImage iconUrl={app.icon} appName={app.name} />
        </div>
      )}

      <div className="mx-3 my-auto">
        <h2 className="mt-0 mb-3">{app.name}</h2>
        {app.developer_name?.trim().length > 0 && (
          <div className="text-sm font-light">
            {t("by", {
              developer: app.developer_name,
            })}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:ml-auto">
        {!user.loading && user.info?.["dev-flatpaks"].includes(app.id) && (
          <Link passHref href={`/apps/manage/${app.id}`}>
            <Button className="mb-3 block w-full last:mb-0">
              {t("developer-settings")}
            </Button>
          </Link>
        )}
        <Button
          className="mb-3 block w-full last:mb-0"
          onClick={installClicked}
        >
          {t("install")}
        </Button>
        {app.urls?.donation && (
          <a
            href={app.urls.donation}
            target="_blank"
            rel="noreferrer"
            onClick={donateClicked}
            className="mb-3 block w-full no-underline last:mb-0"
          >
            <Button variant="secondary" className="w-full">
              {t("donate")}
            </Button>
          </a>
        )}
        {!!vendingSetup?.recommended_donation && (
          <Link passHref href={`/apps/purchase/${app.id}`}>
            <Button className="mb-3 block w-full last:mb-0">
              {t("kind-purchase")}
            </Button>
          </Link>
        )}
      </div>
    </header>
  )
}
