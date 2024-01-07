import { useTranslation } from "next-i18next"
import React, { useCallback, useEffect } from "react"
import { DesktopAppstream } from "src/types/Appstream"
import { VerificationStatus } from "src/types/VerificationStatus"
import ButtonLink from "../ButtonLink"
import LogoImage from "../LogoImage"
import Verification from "./Verification"
import { useUserContext } from "src/context/user-info"
import { useMatomo } from "@mitresthen/matomo-tracker-react"
import InstallButton from "../application/InstallButton"
import { VendingSetup } from "src/codegen"
import Button from "../Button"
import { useMutation } from "@tanstack/react-query"
import { authApi } from "src/api"

export function AppHeader({
  app,
  vendingSetup,
  verificationStatus,
  isQualityModalOpen,
}: {
  app: DesktopAppstream
  vendingSetup: VendingSetup | undefined
  verificationStatus: VerificationStatus
  isQualityModalOpen: boolean
}) {
  const addToCollectionMutation = useMutation({
    mutationKey: ["add-to-collection", app.id],
    mutationFn: (appId: string) =>
      authApi.addToCollectionAuthAddToCollectionPost(appId, {
        withCredentials: true,
      }),
  })

  const removeFromCollectionMutation = useMutation({
    mutationKey: ["remove-from-collection", app.id],
    mutationFn: (appId: string) =>
      authApi.removeFromCollectionAuthRemoveFromCollectionPost(appId, {
        withCredentials: true,
      }),
  })

  const user = useUserContext()
  const { t } = useTranslation()
  const { trackEvent } = useMatomo()

  const donateClicked = (e) => {
    e.preventDefault()
    trackEvent({ category: "App", action: "Donate", name: app.id })
    window.location.href = app.urls.donation
  }
  const [isCollected, setIsCollected] = React.useState(false)

  useEffect(() => {
    if (!user.loading) {
      setIsCollected(user.info?.["collected-flatpaks"].includes(app.id))
    }
  }, [app.id, user.info, user.loading])

  if (user.loading) {
    return null
  }

  return (
    <header className="col-start-2 flex w-full flex-col gap-4 py-7 sm:flex-row">
      {app.icon && (
        <div className="relative m-2 flex h-[128px] min-w-[128px] self-center drop-shadow-md">
          <LogoImage iconUrl={app.icon} appName={app.name} />
        </div>
      )}

      <div className="flex flex-col mx-3 my-auto gap-1">
        <div className="flex items-center justify-center space-x-3 sm:justify-start">
          <h1 className="my-0 text-center text-4xl font-extrabold sm:text-start">
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
        <Verification appId={app.id} verificationStatus={verificationStatus} />
      </div>

      <div className="flex items-center justify-center gap-4 sm:ms-auto">
        {user.info && (
          <Button
            className="w-52 sm:w-32 md:w-40"
            onClick={() => {
              isCollected
                ? removeFromCollectionMutation.mutate(app.id)
                : addToCollectionMutation.mutate(app.id)
              setIsCollected(!isCollected)
            }}
          >
            {t(isCollected ? "uncollect" : "collect")}
          </Button>
        )}
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
