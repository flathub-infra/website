"use client"

import { useFormatter } from "next-intl"
import { useGetIndexStatusMetadataTranslationsIndexStatusGet } from "src/codegen/metadata-translations/metadata-translations"
import { Permission } from "src/codegen/model/permission"
import { useUserContext } from "src/context/user-info"
import { Link } from "src/i18n/navigation"
import ListingLookup from "./lookup"

export default function IndexStatus() {
  const format = useFormatter()
  const user = useUserContext()
  const allowed =
    user.info?.permissions.includes(Permission["manage-apps"]) === true
  const status = useGetIndexStatusMetadataTranslationsIndexStatusGet({
    axios: { withCredentials: true },
    query: { enabled: allowed, refetchInterval: 60_000 },
  })
  const data = status.data?.data
  const checked = data ? data.eligible_apps - data.never_checked : 0
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:gap-10 sm:px-6 sm:py-12">
      <header className="space-y-3">
        <Link
          className="self-start text-sm underline underline-offset-4"
          href="/app-translations"
        >
          Back to app translations
        </Link>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Translation index status
        </h1>
      </header>
      {user.loading ? (
        <p role="status">Loading…</p>
      ) : !allowed ? (
        <p>You need the manage apps permission to view this page.</p>
      ) : (
        <>
          <ListingLookup />
          {status.isError && (
            <p role="alert">
              {data
                ? "Could not refresh the counts. Showing the last available counts."
                : "Could not load the index status. Reload the page to try again."}
            </p>
          )}
          {data ? (
            <section
              aria-labelledby="index-progress"
              className="space-y-5 border-t pt-6"
            >
              <div className="space-y-3">
                <h2 id="index-progress" className="text-xl font-semibold">
                  Index progress
                </h2>
                {data.eligible_apps > 0 ? (
                  <>
                    <p>
                      The worker has checked{" "}
                      <strong className="tabular-nums">
                        {format.number(checked)} of{" "}
                        {format.number(data.eligible_apps)}
                      </strong>{" "}
                      eligible apps.
                    </p>
                    <progress
                      className="block h-2 w-full overflow-hidden rounded-full bg-border accent-primary [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-border [&::-webkit-progress-value]:bg-primary"
                      aria-label="Eligible apps checked at least once"
                      max={data.eligible_apps}
                      value={checked}
                    />
                  </>
                ) : (
                  <p>No apps are eligible for indexing.</p>
                )}
                <p className="max-w-prose text-sm text-muted-foreground">
                  Each check covers all languages, even if the app has nothing
                  to translate.
                </p>
              </div>
              <dl className="divide-y border-y">
                {[
                  {
                    label: "Waiting for a first check",
                    count: data.never_checked,
                  },
                  {
                    label: "Due for another check",
                    count: data.due_for_recheck,
                  },
                ].map(({ label, count }) => (
                  <div
                    key={label}
                    className="flex items-baseline justify-between gap-3 py-2"
                  >
                    <dt>{label}</dt>
                    <dd className="text-lg font-semibold tabular-nums">
                      {format.number(count)}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="max-w-prose text-sm text-muted-foreground">
                Every five minutes, the worker checks up to 12 apps. First
                checks come before rechecks. The oldest recheck goes first. If
                GitHub stops a batch for an authentication or rate limit error,
                the app keeps its place.
              </p>
            </section>
          ) : (
            status.isPending && <p role="status">Loading index status…</p>
          )}
        </>
      )}
    </main>
  )
}
