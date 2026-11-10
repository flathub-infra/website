"use client"

import { useTranslations } from "next-intl"
import { AlertTriangle, Boxes, GitBranch, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { useGetSummarySummaryAppIdGet } from "src/codegen/app/app"
import { Link } from "src/i18n/navigation"
import { useUserContext } from "src/context/user-info"
import { Permission } from "src/codegen/model"
import CheckerHealth from "./CheckerHealth"

interface Props {
  appId: string
  manifestUrl?: string | null
}

export function AppRuntimeWarning({ appId }: { appId: string }) {
  const t = useTranslations("app-maintenance")
  const summary = useGetSummarySummaryAppIdGet(appId)
  const metadata = summary.data?.data?.metadata

  if (
    summary.isPending ||
    summary.isError ||
    !metadata?.runtime ||
    metadata.runtimeIsEol !== true
  ) {
    return null
  }

  return (
    <Alert variant="warning" className="mb-6">
      <AlertTriangle className="size-4" aria-hidden />
      <AlertTitle>{t("runtime-eol")}</AlertTitle>
      <AlertDescription>{t("runtime-eol-description")}</AlertDescription>
    </Alert>
  )
}

export default function AppMaintenance({ appId, manifestUrl }: Props) {
  const t = useTranslations("app-maintenance")
  const user = useUserContext()
  const isAdmin = user.info?.permissions.includes(Permission["modify-users"])
  const summary = useGetSummarySummaryAppIdGet(appId)
  const metadata = summary.data?.data?.metadata
  const runtime = metadata?.runtime
  // An absent runtime record also produces false in the summary API.
  // Only an explicit true establishes EOL; false does not establish support.
  const isEol = !!runtime && metadata?.runtimeIsEol === true
  const packagingUrl = manifestUrl ?? `https://github.com/flathub/${appId}`

  return (
    <div className="border-t border-border">
      <section className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border py-4">
        <div className="flex items-center gap-3">
          <Boxes
            className="size-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <h3 className="text-sm font-semibold">{t("runtime")}</h3>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          {summary.isPending ? (
            <div role="status" aria-label={t("loading-runtime")}>
              <Skeleton className="h-5 w-64 max-w-full" />
            </div>
          ) : summary.isError || !runtime ? (
            <p className="text-sm text-muted-foreground" role="status">
              {t("runtime-unavailable")}
            </p>
          ) : (
            <>
              <code className="text-[13px] [overflow-wrap:anywhere]" dir="ltr">
                {runtime}
              </code>
              {isEol && (
                <Alert variant="warning">
                  <AlertTriangle className="size-4" aria-hidden />
                  <AlertTitle>{t("runtime-eol")}</AlertTitle>
                  <AlertDescription>
                    {t("runtime-eol-description")}
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>
      </section>
      <div className="grid gap-5 py-5 sm:grid-cols-2 sm:gap-6">
        <section className="flex min-w-0 flex-col items-start gap-2">
          <div className="flex items-center gap-3">
            <GitBranch
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <h3 className="text-sm font-semibold">{t("builds")}</h3>
          </div>
          <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
            {t("builds-description")}
          </p>
          <div className="mt-auto flex max-w-full flex-wrap items-center gap-3">
            <Button
              asChild
              variant="outline"
              className="h-auto min-h-9 max-w-full whitespace-normal text-start text-foreground"
            >
              <Link href={`/builds/apps/${appId}`}>{t("view-builds")}</Link>
            </Button>
          </div>
        </section>
        <section className="flex min-w-0 flex-col items-start gap-2 sm:border-s sm:border-border sm:ps-6">
          <div className="flex items-center gap-3">
            <RefreshCw
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <h3 className="text-sm font-semibold">{t("update-checker")}</h3>
          </div>
          <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
            {t("checker-description")}
          </p>
          <div className="mt-auto flex max-w-full flex-wrap items-center gap-x-4 gap-y-1">
            <Button
              asChild
              variant="outline"
              className="h-auto min-h-9 max-w-full whitespace-normal text-start text-foreground"
            >
              <a href={packagingUrl} target="_blank" rel="noreferrer">
                {t(manifestUrl != null ? "view-manifest" : "view-repository")}
              </a>
            </Button>
            <Button
              asChild
              variant="link"
              className="h-auto min-h-7 max-w-full whitespace-normal px-0 text-start text-xs text-foreground underline underline-offset-4"
            >
              <a
                href="https://github.com/flathub-infra/flatpak-external-data-checker#readme"
                target="_blank"
                rel="noreferrer"
              >
                {t("checker-docs")}
              </a>
            </Button>
          </div>
        </section>
      </div>
      {isAdmin && <CheckerHealth appId={appId} />}
    </div>
  )
}
