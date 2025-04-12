import { useTranslation } from "next-i18next"
import React from "react"
import { Appstream } from "src/types/Appstream"
import { VerificationStatus } from "src/types/VerificationStatus"
import LogoImage from "../LogoImage"
import Verification from "./Verification"
import { useMatomo } from "@mitresthen/matomo-tracker-react"
import InstallButton from "../application/InstallButton"
import { VendingSetup } from "src/codegen"
import { useRouter } from "next/router"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import dynamic from "next/dynamic"

const ClientSideFavoriteButton = dynamic(
  () => import('./ClientSideFavoriteButton'),
  { ssr: false }
)

export function AppHeader({
  app,
  vendingSetup,
  verificationStatus,
  isQualityModalOpen,
}: {
  app: Appstream
  vendingSetup: Pick<VendingSetup, "recommended_donation"> | undefined
  verificationStatus: VerificationStatus
  isQualityModalOpen: boolean
}) {
  const { t } = useTranslation()
  const { trackEvent } = useMatomo()
  const { push } = useRouter()

  const donateClicked = (e) => {
    if (!app.urls?.donation) return

    e.preventDefault()
    trackEvent({ category: "App", action: "Donate", name: app.id })
    push(app.urls.donation)
  }

  return (
    <header className="col-start-2 flex w-full flex-col gap-7 py-7 sm:flex-row">
      {app.icon && (
        <div className="relative m-2 flex h-[128px] min-w-[128px] self-center drop-shadow-md">
          <LogoImage
            iconUrl={app.icon}
            appName={app.name}
            quality={100}
            priority
          />
        </div>
      )}

      <div className="flex flex-col my-auto gap-1">
        <div className="flex items-center justify-center space-x-3 sm:justify-start">
          <h1 className="my-0 text-center text-4xl font-extrabold sm:text-start truncate">
            {app.name.length > 20 && isQualityModalOpen ? (
              <>
                <span>{app.name.slice(0, 20)}</span>{" "}
                <mark>{app.name.slice(20, app.name.length)}</mark>
              </>
            ) : (
              app.name
            )}
          </h1>
        </div>
        {app.developer_name?.trim().length > 0 && (
          <div className="text-center text-sm font-light text-flathub-sonic-silver dark:text-flathub-spanish-gray sm:text-start">
            {t("by", {
              developer: app.developer_name,
            })}
          </div>
        )}
        {(app.type === "desktop-application" ||
          app.type === "desktop" ||
          app.type === "console-application") && (
          <Verification
            appId={app.id}
            verificationStatus={verificationStatus}
          />
        )}
      </div>

      <div className="flex items-center justify-center gap-4 sm:ms-auto">
        <ClientSideFavoriteButton appId={app.id} />
        <InstallButton appId={app.id} />
        {app.urls?.donation && (
          <Button
            onClick={donateClicked}
            asChild
            className="w-52 basis-1/2 sm:w-32 md:w-40"
            variant="secondary"
            size="xl"
          >
            <a target="_blank" rel="noreferrer" href={app.urls.donation}>
              {t("donate")}
            </a>
          </Button>
        )}
        {!!vendingSetup?.recommended_donation && (
          <Button size="xl" asChild className="w-52 sm:w-32 md:w-40">
            <Link href={`/apps/purchase/${app.id}`}>{t("kind-purchase")}</Link>
          </Button>
        )}
      </div>
    </header>
  )
}
