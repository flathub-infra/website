import { useTranslations } from "next-intl"
import React from "react"
import LogoImage from "../LogoImage"
import Verification from "./Verification"
import { useUserContext } from "src/context/user-info"
import { useMatomo } from "@mitresthen/matomo-tracker-react"
import InstallButton from "../application/InstallButton"
import {
  GetAppstreamAppstreamAppIdGet200,
  GetVerificationStatusVerificationAppIdStatusGet200,
  useAddToFavoritesFavoritesAppIdAddPost,
  useIsFavoritedFavoritesAppIdGet,
  useRemoveFromFavoritesFavoritesAppIdRemoveDelete,
  VendingSetup,
} from "src/codegen"
import { Button } from "@/components/ui/button"
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react"
import { Link, useRouter } from "src/i18n/navigation"

const FavoriteButton = ({ appId }: { appId: string }) => {
  const t = useTranslations()
  const user = useUserContext()

  const [countChanges, setCountChanges] = React.useState(0)

  const isFavoriteQuery = useIsFavoritedFavoritesAppIdGet(appId, {
    axios: { withCredentials: true },
    query: { enabled: !!user.info },
  })

  const addToFavoriteMutation = useAddToFavoritesFavoritesAppIdAddPost({
    axios: { withCredentials: true },
  })

  const removeFromFavoriteMutation =
    useRemoveFromFavoritesFavoritesAppIdRemoveDelete({
      axios: { withCredentials: true },
    })

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
      aria-label={t("favorite")}
      aria-pressed={isFavoriteQuery.data.data}
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
  app: GetAppstreamAppstreamAppIdGet200
  vendingSetup: Pick<VendingSetup, "recommended_donation"> | undefined
  verificationStatus: GetVerificationStatusVerificationAppIdStatusGet200
  isQualityModalOpen: boolean
}) {
  const t = useTranslations()
  const user = useUserContext()
  const { trackEvent } = useMatomo()
  const { push } = useRouter()
  const isOwned = user.info?.owned_flatpaks?.includes(app.id) ?? false

  const donateClicked = (e) => {
    if (!app.urls?.donation) {
      return
    }

    e.preventDefault()
    trackEvent({ category: "App", action: "Donate", name: app.id })
    push(app.urls.donation)
  }

  return (
    <header className="col-start-2 flex min-w-0 w-full flex-wrap items-center justify-center gap-6 py-8 sm:justify-start">
      {app.icon && (
        <div className="relative m-2 flex size-32 shrink-0 self-center">
          <div className="absolute inset-0 rounded-[28px] bg-flathub-celestial-blue/8 dark:bg-flathub-celestial-blue/10 blur-xl scale-110" />
          <div className="relative drop-shadow-lg">
            <LogoImage
              iconUrl={app.icon}
              appName={app.name}
              quality={100}
              priority
              size={128}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 basis-full flex-col gap-2 sm:flex-1 sm:basis-64">
        <div className="min-w-0">
          <h1 className="my-0 text-center text-3xl leading-tight font-extrabold tracking-tight [overflow-wrap:anywhere] sm:text-start sm:text-4xl">
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
          <div className="text-center text-sm leading-relaxed font-normal text-flathub-granite-gray [overflow-wrap:anywhere] dark:text-flathub-spanish-gray sm:text-start">
            {t(verificationStatus.verified ? "by" : "developed-by", {
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

      <div className="flex w-full flex-wrap items-center justify-center gap-3 sm:ms-auto sm:w-auto sm:max-w-full">
        <FavoriteButton appId={app.id} />
        <InstallButton appId={app.id} />
        {app.urls?.donation && (
          <Button
            onClick={donateClicked}
            asChild
            className="h-auto min-h-11 min-w-32 max-w-full flex-1 whitespace-normal break-words sm:flex-none"
            variant="secondary"
            size="xl"
          >
            <a target="_blank" rel="noreferrer" href={app.urls.donation}>
              {t("donate")}
            </a>
          </Button>
        )}
        {!!vendingSetup?.recommended_donation && !isOwned && (
          <Button
            size="xl"
            asChild
            className="h-auto min-h-11 min-w-32 max-w-full flex-1 whitespace-normal break-words sm:flex-none"
          >
            <Link href={`/apps/purchase/${app.id}`}>{t("kind-purchase")}</Link>
          </Button>
        )}
      </div>
    </header>
  )
}
