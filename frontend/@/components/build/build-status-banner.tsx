"use client"

import { useStatusBannerApiApiStatusBannerGet } from "src/codegen-pipeline"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"

export function BuildStatusBanner() {
  const query = useStatusBannerApiApiStatusBannerGet({
    query: { refetchInterval: 2 * 60 * 60 * 1000 },
  })
  const banner = query.data?.data
  if (query.isError && !banner) {
    return (
      <Alert>
        <AlertDescription>
          <p>
            Could not load service status.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => query.refetch()}
            >
              Retry
            </button>
          </p>
        </AlertDescription>
      </Alert>
    )
  }
  if (!banner) return null
  return (
    <Alert variant={banner.severity === "error" ? "destructive" : "default"}>
      <AlertTitle>{banner.label}</AlertTitle>
      <AlertDescription>
        <p>
          {banner.summary_status} —{" "}
          <a
            className="underline"
            href={banner.status_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Service status
          </a>
        </p>
        {banner.issues.map((issue) => (
          <p key={issue.permalink}>
            <span>{issue.system}: </span>
            <a
              className="underline"
              href={issue.permalink}
              target="_blank"
              rel="noopener noreferrer"
            >
              {issue.title}
            </a>
          </p>
        ))}
        {query.isRefetchError && (
          <p>Could not refresh service status; showing the last report.</p>
        )}
      </AlertDescription>
    </Alert>
  )
}
