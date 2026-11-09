"use client"

import { useTranslations } from "next-intl"
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  GitBranch,
  RefreshCw,
} from "lucide-react"
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
      <section className="grid grid-cols-1 items-center gap-3 border-b border-border py-[18px] min-[641px]:grid-cols-[minmax(160px,0.6fr)_minmax(0,1fr)] min-[641px]:gap-x-6 min-[641px]:gap-y-4 min-[1101px]:grid-cols-[minmax(170px,0.65fr)_minmax(0,1fr)_minmax(210px,0.65fr)]">
        <div className="flex items-center gap-3">
          <Boxes
            className="size-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <h3 className="text-sm font-semibold">{t("runtime")}</h3>
        </div>
        <div className="col-start-1 flex min-w-0 flex-col gap-3 min-[641px]:col-[2/-1]">
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
      <section className="grid grid-cols-1 items-center gap-3 border-b border-border py-[18px] min-[641px]:grid-cols-[minmax(160px,0.6fr)_minmax(0,1fr)] min-[641px]:gap-x-6 min-[641px]:gap-y-4 min-[1101px]:grid-cols-[minmax(170px,0.65fr)_minmax(0,1fr)_minmax(210px,0.65fr)]">
        <div className="flex items-center gap-3">
          <GitBranch
            className="size-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <h3 className="text-sm font-semibold">{t("builds")}</h3>
        </div>
        <p className="text-sm leading-[1.55] text-muted-foreground min-[641px]:max-w-[38ch]">
          {t("builds-description")}
        </p>
        <div className="col-start-1 flex max-w-[440px] flex-col items-start gap-2 min-[641px]:col-start-2 min-[1101px]:col-start-auto">
          <Button
            asChild
            variant="outline"
            className="h-auto min-h-9 max-w-full whitespace-normal text-start text-foreground"
          >
            <Link href={`/builds/apps/${appId}`}>{t("view-builds")}</Link>
          </Button>
        </div>
      </section>
      <section className="grid grid-cols-1 items-center gap-3 py-[18px] min-[641px]:grid-cols-[minmax(160px,0.6fr)_minmax(0,1fr)] min-[641px]:gap-x-6 min-[641px]:gap-y-4 min-[1101px]:grid-cols-[minmax(170px,0.65fr)_minmax(0,1fr)_minmax(210px,0.65fr)]">
        <div className="flex items-center gap-3">
          <RefreshCw
            className="size-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <h3 className="text-sm font-semibold">{t("update-checker")}</h3>
        </div>
        <p className="text-sm leading-[1.55] text-muted-foreground min-[641px]:max-w-[38ch]">
          {t("checker-description")}
        </p>
        <div className="col-start-1 flex max-w-[440px] flex-col items-start gap-2 min-[641px]:col-start-2 min-[1101px]:col-start-auto">
          <Button
            asChild
            variant="outline"
            className="h-auto min-h-9 max-w-full whitespace-normal text-start text-foreground"
          >
            <a href={packagingUrl} target="_blank" rel="noreferrer">
              {t(manifestUrl != null ? "view-manifest" : "view-repository")}
              <ArrowUpRight data-icon="inline-end" aria-hidden />
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
      {isAdmin && <CheckerHealth appId={appId} />}
    </div>
  )
}
