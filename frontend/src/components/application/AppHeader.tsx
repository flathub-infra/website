import { useFormatter, useTranslations } from "next-intl"
import { useQueryClient } from "@tanstack/react-query"
import LogoImage from "../LogoImage"
import Verification from "./Verification"
import { useUserContext } from "src/context/user-info"
import { useMatomo } from "@mitresthen/matomo-tracker-react"
import InstallButton from "../application/InstallButton"
import {
  GetAppstreamAppstreamAppIdGet200,
  GetVerificationStatusVerificationAppIdStatusGet200,
  getGetCurrentFavoritesCountFavoritesAppIdCountCurrentGetQueryKey,
  getIsFavoritedFavoritesAppIdGetQueryKey,
  useAddToFavoritesFavoritesAppIdAddPost,
  useGetAppFavoritesCountFavoritesAppIdCountGet,
  useGetCurrentFavoritesCountFavoritesAppIdCountCurrentGet,
  useIsFavoritedFavoritesAppIdGet,
  useRemoveFromFavoritesFavoritesAppIdRemoveDelete,
  VendingSetup,
} from "src/codegen"
import { Button } from "@/components/ui/button"
import { Bookmark, Heart } from "lucide-react"
import { loginHref } from "../login/loginHref"
import { Link } from "src/i18n/navigation"
import { appstreamUrl } from "./appstream-url"

const actionPill =
  "h-9 gap-1.5 rounded-full px-3.5 text-sm font-semibold pointer-coarse:min-h-11 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"

const FavoriteButton = ({ appId }: { appId: string }) => {
  const t = useTranslations()
  const user = useUserContext()

  const format = useFormatter()
  const client = useQueryClient()
  const publicCount = useGetAppFavoritesCountFavoritesAppIdCountGet(appId, {
    query: { enabled: !user.loading && !user.info },
  })
  const currentCount = useGetCurrentFavoritesCountFavoritesAppIdCountCurrentGet(
    appId,
    {
      axios: { withCredentials: true },
      query: { enabled: !!user.info },
    },
  )
  const countQuery = user.info ? currentCount : publicCount
  const count = countQuery.data?.data.favorites_count
  const description =
    count === undefined ? undefined : t("bookmark-count", { count })

  const isFavoriteQuery = useIsFavoritedFavoritesAppIdGet(appId, {
    axios: { withCredentials: true },
    query: { enabled: !!user.info },
  })

  const mutationOptions = {
    axios: { withCredentials: true },
    mutation: {
      onSuccess: async (_result: unknown, { appId }: { appId: string }) => {
        await Promise.all(
          [
            getIsFavoritedFavoritesAppIdGetQueryKey(appId),
            getGetCurrentFavoritesCountFavoritesAppIdCountCurrentGetQueryKey(
              appId,
            ),
          ].map(async (queryKey) => {
            await client.cancelQueries({ queryKey, exact: true })
            await client.invalidateQueries({ queryKey, exact: true })
          }),
        )
      },
    },
  }
  const addToFavoriteMutation =
    useAddToFavoritesFavoritesAppIdAddPost(mutationOptions)

  const removeFromFavoriteMutation =
    useRemoveFromFavoritesFavoritesAppIdRemoveDelete(mutationOptions)

  const bookmarked = !!user.info && isFavoriteQuery.data?.data
  const props = {
    variant: "ghost",
    size: "sm",
    className: `${actionPill} bg-flathub-celestial-blue/10 text-flathub-celestial-blue-dark hover:bg-flathub-celestial-blue/20 aria-pressed:bg-flathub-celestial-blue/20 dark:bg-flathub-celestial-blue/15 dark:text-blue-200 dark:hover:bg-flathub-celestial-blue/25 dark:aria-pressed:bg-flathub-celestial-blue/25`,
  } as const
  const content = (
    <>
      <Bookmark size={16} fill={bookmarked ? "currentColor" : "none"} />
      {count !== undefined && (
        <span className="relative top-px tabular-nums">
          {format.number(count)}
        </span>
      )}
    </>
  )
  if (!user.info && !user.loading) {
    return (
      <Button {...props} asChild>
        <Link
          href={loginHref(`/apps/${appId}`)}
          title={t("login-to-bookmark")}
          aria-label={t("login-to-bookmark")}
          aria-description={description}
        >
          {content}
        </Link>
      </Button>
    )
  }
  const mutation = bookmarked
    ? removeFromFavoriteMutation
    : addToFavoriteMutation
  return (
    <Button
      {...props}
      title={t(bookmarked ? "remove-bookmark" : "favorite")}
      aria-label={t("favorite")}
      aria-description={description}
      aria-pressed={!!bookmarked}
      disabled={
        !isFavoriteQuery.data ||
        user.loading ||
        addToFavoriteMutation.isPending ||
        removeFromFavoriteMutation.isPending
      }
      onClick={() => mutation.mutate({ appId })}
    >
      {content}
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
  const donationUrl = appstreamUrl(app.urls?.donation)
  const developerName = app.developer_name?.trim()
  const isOwned = user.info?.owned_flatpaks?.includes(app.id) ?? false

  const donateClicked = () => {
    trackEvent({ category: "App", action: "Donate", name: app.id })
  }

  return (
    <header className="col-start-2 flex min-w-0 w-full flex-wrap items-center justify-center gap-4 py-6 sm:justify-start sm:gap-6 sm:py-8">
      {app.icon && (
        <div className="relative flex size-24 shrink-0 self-center sm:m-2 sm:size-32">
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
        {app.type === "desktop-application" ||
        app.type === "desktop" ||
        app.type === "console-application" ? (
          <Verification
            appId={app.id}
            verificationStatus={verificationStatus}
            developerName={developerName}
          />
        ) : (
          developerName && (
            <div className="text-center text-sm leading-relaxed text-flathub-granite-gray [overflow-wrap:anywhere] dark:text-flathub-spanish-gray sm:text-start">
              {t(verificationStatus.verified ? "by" : "developed-by", {
                developer: developerName,
              })}
            </div>
          )
        )}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1 sm:justify-start">
          {donationUrl && (
            <Button
              onClick={donateClicked}
              asChild
              className={`${actionPill} bg-flathub-sunset-pink/10 text-rose-800 hover:bg-flathub-sunset-pink/20 dark:text-rose-200`}
              variant="ghost"
              size="sm"
            >
              <a target="_blank" rel="noreferrer" href={donationUrl}>
                <Heart size={16} />
                {t("donate")}
              </a>
            </Button>
          )}
          <FavoriteButton appId={app.id} />
        </div>
      </div>

      <div className="flex w-full flex-wrap items-center justify-center gap-3 sm:ms-auto sm:w-auto sm:max-w-full">
        <InstallButton appId={app.id} />
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
