import { useTranslation } from "next-i18next"
import React from "react"
import { Appstream } from "src/types/Appstream"
import { VerificationStatus } from "src/types/VerificationStatus"
import LogoImage from "../LogoImage"
import Verification from "./Verification"
import { useUserContext } from "src/context/user-info"
import { useMatomo } from "@mitresthen/matomo-tracker-react"
import InstallButton from "../application/InstallButton"
import {
  useAddToFavoritesFavoritesAppIdAddPost,
  useIsFavoritedFavoritesAppIdGet,
  useRemoveFromFavoritesFavoritesAppIdRemoveDelete,
  VendingSetup,
} from "src/codegen"
import { useRouter } from "next/router"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react"

const FavoriteButton = ({ appId }: { appId: string }) => {
  const { t } = useTranslation()

  const [countChanges, setCountChanges] = React.useState(0)

  const isFavoriteQuery = useIsFavoritedFavoritesAppIdGet(appId, {
    axios: { withCredentials: true },
  })

  const addToFavoriteMutation = useAddToFavoritesFavoritesAppIdAddPost({
    axios: { withCredentials: true },
  })

  const removeFromFavoriteMutation =
    useRemoveFromFavoritesFavoritesAppIdRemoveDelete({
      axios: { withCredentials: true },
    })

  const user = useUserContext()

  if (!user.info || isFavoriteQuery.isLoading || countChanges > 3) {
    return null
  }

  if (
    isFavoriteQuery.isPending ||
    addToFavoriteMutation.isPending ||
    removeFromFavoriteMutation.isPending
  ) {
    return (
      <Button variant="ghost" size="icon-lg" disabled>
        <Loader2 className="animate-spin" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon-lg"
      title={t("favorite")}
      onClick={() => {
        isFavoriteQuery.data.data
          ? removeFromFavoriteMutation.mutate(
              {
                appId: appId,
              },
              {
                onSuccess: () => {
                  isFavoriteQuery.refetch()
                  setCountChanges(countChanges + 1)
                },
              },
            )
          : addToFavoriteMutation.mutate(
              { appId: appId },
              {
                onSuccess: () => {
                  isFavoriteQuery.refetch()
                  setCountChanges(countChanges + 1)
                },
              },
            )
      }}
    >
      {isFavoriteQuery.data.data ? <BookmarkCheck /> : <Bookmark />}
    </Button>
  )
}

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
        <FavoriteButton appId={app.id} />
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
