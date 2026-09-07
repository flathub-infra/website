"use client"

import { useTranslations } from "next-intl"
import UserApps from "../../../../src/components/user/UserApps"
import { IS_PRODUCTION } from "../../../../src/env"
import Breadcrumbs from "../../../../src/components/Breadcrumbs"
import ApplicationCollectionSuspense from "../../../../src/components/application/ApplicationCollectionSuspense"
import {
  useGetFavoritesFavoritesGet,
  useRemoveFromFavoritesFavoritesAppIdRemoveDelete,
} from "../../../../src/codegen"
import Spinner from "../../../../src/components/Spinner"
import { getAppsInfo } from "../../../../src/asyncs/app"
import { useQuery } from "@tanstack/react-query"
import { useRef, type JSX } from "react"
import CodeCopy from "../../../../src/components/application/CodeCopy"
import { Button } from "@/components/ui/button"
import { BookmarkMinus, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface MyFlathubClientProps {
  locale: string
}

const RemoveFavoriteButton = ({
  appId,
  appName,
  onRemoved,
}: {
  appId: string
  appName: string
  onRemoved: () => Promise<unknown> | void
}) => {
  const t = useTranslations()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const removeMutation = useRemoveFromFavoritesFavoritesAppIdRemoveDelete({
    axios: { withCredentials: true },
    mutation: {
      onSuccess: async () => {
        const buttons = Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            "[data-remove-favorite]",
          ),
        )
        const buttonIndex = buttonRef.current
          ? buttons.indexOf(buttonRef.current)
          : -1

        await onRemoved()

        requestAnimationFrame(() => {
          const remainingButtons = document.querySelectorAll<HTMLButtonElement>(
            "[data-remove-favorite]",
          )
          const nextButton =
            remainingButtons[
              Math.min(Math.max(buttonIndex, 0), remainingButtons.length - 1)
            ]

          if (nextButton) {
            nextButton.focus()
          } else {
            document
              .querySelector<HTMLElement>("[data-my-flathub-heading]")
              ?.focus()
          }
        })
      },
      onError: () => toast.error(t("network-error-try-again")),
    },
  })

  const label = t("remove-from-favorites", { app: appName })

  return (
    <Button
      ref={buttonRef}
      data-remove-favorite
      variant="ghost"
      size="sm"
      className="text-flathub-sonic-silver hover:bg-destructive/10 hover:text-destructive active:bg-destructive/15 active:text-destructive focus-visible:text-destructive disabled:pointer-events-auto dark:text-flathub-spanish-gray dark:hover:text-destructive"
      title={label}
      aria-label={label}
      disabled={removeMutation.isPending}
      onClick={() => removeMutation.mutate({ appId })}
    >
      {removeMutation.isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <BookmarkMinus className="size-4" />
      )}
      {t("remove-bookmark")}
    </Button>
  )
}

const FavoriteApps = ({ locale }: { locale: string }) => {
  const t = useTranslations()

  const favoritesQuery = useGetFavoritesFavoritesGet({
    axios: {
      withCredentials: true,
    },
  })

  const appIds = favoritesQuery.data?.data?.map((app) => app.app_id) || []

  const appdetailQuery = useQuery({
    queryKey: ["favorite-apps", locale, appIds],
    queryFn: async () => {
      const data = await getAppsInfo(appIds, locale)
      return data
    },
    enabled: !!favoritesQuery.data && appIds.length > 0,
    placeholderData: (previousData) =>
      previousData?.filter((app) => appIds.includes(app.id)),
  })

  if (appdetailQuery.isLoading || favoritesQuery.isLoading) {
    return <Spinner size="m" />
  }

  if (appIds.length === 0) {
    return (
      <div>
        <h2 className="mb-4 text-2xl font-bold">{t("favorite-apps")}</h2>
        <p className="text-flathub-sonic-silver dark:text-flathub-spanish-gray">
          {t("no-favorites-yet")}
        </p>
      </div>
    )
  }

  const installCommand = `flatpak install ${appIds.join(" ")}`

  return (
    <div className="space-y-6">
      <ApplicationCollectionSuspense
        title={t("favorite-apps")}
        applications={appdetailQuery.data}
        variant="nested"
        renderItemAction={(app) => (
          <RemoveFavoriteButton
            appId={app.id}
            appName={app.name}
            onRemoved={() => favoritesQuery.refetch()}
          />
        )}
      />
      <div>
        <h3 className="mb-3 text-xl font-semibold">
          {t("install-all-favorites")}
        </h3>
        <p className="mb-3 text-sm text-flathub-sonic-silver dark:text-flathub-spanish-gray">
          {t("install-all-favorites-description")}
        </p>
        <CodeCopy text={installCommand} nested />
      </div>
    </div>
  )
}

const MyFlathubClient = ({ locale }: MyFlathubClientProps): JSX.Element => {
  const t = useTranslations()

  const pages = [{ name: t("my-flathub"), current: true, href: "/my-flathub" }]

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <div className="space-y-12">
        <Breadcrumbs pages={pages} />
        <div className="mt-4 p-4 flex flex-wrap gap-3 rounded-xl bg-flathub-white shadow-md dark:bg-flathub-arsenic">
          <h1
            data-my-flathub-heading
            tabIndex={-1}
            className="text-4xl font-extrabold"
          >
            {t("my-flathub")}
          </h1>
          <div className="space-y-12 w-full">
            {!IS_PRODUCTION && (
              <>
                <UserApps variant="owned" locale={locale} />
              </>
            )}
            <FavoriteApps locale={locale} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default MyFlathubClient
