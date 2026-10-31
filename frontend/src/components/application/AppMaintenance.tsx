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

interface Props {
  appId: string
  manifestUrl?: string | null
}

export default function AppMaintenance({ appId, manifestUrl }: Props) {
  const t = useTranslations("app-maintenance")
  const summary = useGetSummarySummaryAppIdGet(appId)
  const metadata = summary.data?.data?.metadata
  const runtime = metadata?.runtime
  // An absent runtime record also produces false in the summary API.
  // Only an explicit true establishes EOL; false does not establish support.
  const isEol = !!runtime && metadata?.runtimeIsEol === true
  const manifest =
    manifestUrl && /^https?:\/\//i.test(manifestUrl) ? manifestUrl : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-3">
        <Boxes
          className="mt-1 size-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h3 className="font-semibold">{t("runtime")}</h3>
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
              <code className="break-all text-sm" dir="ltr">
                {runtime}
              </code>
              {isEol && (
                <Alert variant="destructive">
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
      </div>
      <div className="flex gap-3">
        <GitBranch
          className="mt-1 size-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h3 className="font-semibold">{t("builds")}</h3>
          <Button asChild variant="secondary" className="self-start">
            <Link href={`/builds/apps/${appId}`}>{t("view-builds")}</Link>
          </Button>
        </div>
      </div>
      <div className="flex gap-3">
        <RefreshCw
          className="mt-1 size-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h3 className="font-semibold">{t("update-checker")}</h3>
          <div className="flex flex-wrap items-center gap-2">
            {manifest ? (
              <Button asChild variant="secondary">
                <a href={manifest} target="_blank" rel="noreferrer">
                  {t("view-manifest")}
                  <ArrowUpRight data-icon="inline-end" aria-hidden />
                </a>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("manifest-unavailable")}
              </p>
            )}
            <Button asChild variant="outline">
              <a
                href="https://github.com/flathub/flatpak-external-data-checker#readme"
                target="_blank"
                rel="noreferrer"
              >
                {t("checker-docs")}
                <ArrowUpRight data-icon="inline-end" aria-hidden />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
