"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useLocale } from "next-intl"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isValidAppId } from "@/lib/helpers"
import { getLanguageName, languages } from "src/localize"
import TranslationLanguageSelect from "src/components/application/TranslationLanguageSelect"
import { resolveTranslationLanguage } from "src/components/application/translationLanguages"
import { Link, useRouter } from "src/i18n/navigation"
import { useUserContext } from "src/context/user-info"
import { Permission } from "src/codegen/model/permission"
import type { QueueApp } from "src/codegen/model/queueApp"
import { getTranslationQueueMetadataTranslationsQueueGet } from "src/codegen/metadata-translations/metadata-translations"
import MetadataTranslationEditor from "src/components/application/MetadataTranslationEditor"
import {
  readPreference,
  writePreference,
} from "src/components/application/translationStorage"

export default function AppTranslations({ language }: { language?: string }) {
  const router = useRouter()
  const locale = useLocale()
  const user = useUserContext()
  const canManageApps = user.info?.permissions.includes(
    Permission["manage-apps"],
  )
  const account = user.info?.default_account
  const knownLanguage = languages.find((l) => l === language)
  const [choice, setChoice] = useState<string>(() => {
    const last = readPreference("app-translations.language")
    return (
      resolveTranslationLanguage(last) ??
      resolveTranslationLanguage(locale) ??
      ""
    )
  })
  useEffect(() => {
    if (language) {
      writePreference("app-translations.language", language)
    }
  }, [language])
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          App translations
        </h1>
        {canManageApps && (
          <p className="max-w-prose text-muted-foreground">
            {language
              ? `Translate app listings into ${knownLanguage ? getLanguageName(knownLanguage) : language}.`
              : "Help people discover apps in their language by translating names, summaries, and descriptions."}
          </p>
        )}
      </header>
      {!canManageApps ? (
        !user.loading && <p>Only admins can translate app listings for now.</p>
      ) : language ? (
        <>
          <Link className="self-start underline" href="/app-translations">
            Change language
          </Link>
          <Queue
            key={`${account?.provider}:${account?.login}:${language}`}
            language={language}
            account={`${account?.provider}:${account?.login}`}
          />
        </>
      ) : (
        <form
          className="max-w-2xl space-y-4 rounded-xl border bg-card p-5 sm:p-8"
          onSubmit={(e) => {
            e.preventDefault()
            router.push(`/app-translations/${choice}`)
          }}
        >
          <label
            className="block text-xl font-semibold"
            htmlFor="queue-language"
          >
            Choose a translation language
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <TranslationLanguageSelect
              id="queue-language"
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
            />
            <Button type="submit">Open translation queue</Button>
          </div>
        </form>
      )}
      <p className="border-t pt-5 text-sm text-muted-foreground">
        {canManageApps && (
          <Link
            className="mb-2 block w-fit underline underline-offset-4"
            href="/app-translations/index-status"
          >
            Translation index status
          </Link>
        )}
        <a
          href="https://hosted.weblate.org/engage/flathub/"
          className="underline underline-offset-4"
        >
          Translate the Flathub website on Weblate
        </a>
      </p>
    </main>
  )
}

type Pass = { current: string; skipped: string[] }
const emptyPass: Pass = { current: "", skipped: [] }
type AppGroup = { title: string; apps: QueueApp[] }

function AppPicker({
  groups,
  language,
  appId,
}: {
  groups: AppGroup[]
  language: string
  appId?: string
}) {
  const [filter, setFilter] = useState("")
  const [choosing, setChoosing] = useState(false)
  const search = filter.trim().toLowerCase()
  const matching = choosing
    ? groups
        .map(({ title, apps }) => ({
          title,
          apps: apps.filter((a) =>
            `${a.name} ${a.app_id}`.toLowerCase().includes(search),
          ),
        }))
        .filter(({ apps }) => apps.length)
    : []
  return (
    <details
      onToggle={(event) => setChoosing(event.currentTarget.open)}
      className="rounded-xl border bg-card p-4"
    >
      <summary className="cursor-pointer font-semibold">
        Choose an app (
        {groups.reduce((count, group) => count + group.apps.length, 0)})
      </summary>
      {choosing && (
        <div className="mt-4 space-y-3">
          <Input
            aria-label="Find an app by name or ID"
            placeholder="Find an app by name or ID"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <div className="max-h-72 overflow-y-auto">
            {matching.map(({ title, apps }) => (
              <section key={title}>
                <h2 className="py-2 text-sm font-semibold text-muted-foreground">
                  {title}
                </h2>
                <ul>
                  {apps.map((a) => (
                    <li key={a.app_id}>
                      <Link
                        prefetch={false}
                        scroll={false}
                        href={`/app-translations/${language}?app=${encodeURIComponent(a.app_id)}`}
                        aria-current={a.app_id === appId ? "page" : undefined}
                        className="flex flex-wrap items-baseline justify-between gap-x-4 rounded-md px-2 py-2 hover:bg-muted aria-[current=page]:bg-muted"
                      >
                        <span>{a.name}</span>
                        <span className="break-all text-sm text-muted-foreground">
                          {a.app_id}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {!matching.length && <p role="status">No matching apps.</p>}
          </div>
        </div>
      )}
    </details>
  )
}

function Queue({ language, account }: { language: string; account: string }) {
  const requested = useSearchParams()?.get("app")
  const { info } = useUserContext()
  const mine = new Set(info?.dev_flatpaks)
  const storageKey = `app-translations.pass:${account}:${language}`
  const [pass, setPass] = useState<Pass>(() => {
    try {
      const stored = JSON.parse(readPreference(storageKey) ?? "null")
      return typeof stored?.current === "string" &&
        Array.isArray(stored.skipped)
        ? stored
        : emptyPass
    } catch {
      return emptyPass
    }
  })
  const [finished, setFinished] = useState<string[]>([])
  const queue = useQuery({
    queryKey: ["app-translation-queue", account, language],
    queryFn: async () =>
      (
        await getTranslationQueueMetadataTranslationsQueueGet(
          { locale: language },
          { withCredentials: true },
        )
      ).data,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: (query) => (query.state.data?.indexing ? 60_000 : false),
    retry: false,
  })
  async function refreshQueue() {
    if ((await queue.refetch()).isSuccess) {
      setFinished([])
    }
  }
  const maintained: QueueApp[] = []
  const recent: QueueApp[] = []
  for (const app of queue.data?.apps ?? []) {
    if (finished.includes(app.app_id)) {
      continue
    }
    const group = mine.has(app.app_id) ? maintained : recent
    group.push(app)
  }
  const groups = [
    { title: "My apps", apps: maintained },
    { title: "Recently updated", apps: recent },
  ]
  const ordered = [...maintained, ...recent]
  const available = ordered.filter((a) => !pass.skipped.includes(a.app_id))
  const [selected, setSelected] = useState<QueueApp>()
  const app = requested
    ? (ordered.find((a) => a.app_id === requested) ??
      (selected?.app_id === requested ? selected : undefined))
    : (available.find((a) => a.app_id === pass.current) ?? available[0])
  useLayoutEffect(() => setSelected(app), [app])
  const appId = app?.app_id
  const activeApp = useRef<string | undefined>(undefined)
  useLayoutEffect(() => {
    activeApp.current = appId
    return () => {
      activeApp.current = undefined
    }
  }, [appId])
  function updateAddress(id?: string) {
    const url = new URL(window.location.href)
    if (id) {
      url.searchParams.set("app", id)
    } else {
      url.searchParams.delete("app")
    }
    window.history.replaceState(null, "", url)
  }
  useEffect(() => {
    if (!requested && appId) {
      updateAddress(appId)
    }
    writePreference(
      storageKey,
      JSON.stringify({ ...pass, current: appId ?? pass.current }),
    )
  }, [appId, requested, pass, storageKey])
  if (queue.isError && !queue.data) {
    return (
      <div role="alert">
        Could not load app translations.{" "}
        <Button variant="outline" onClick={refreshQueue}>
          Try again
        </Button>
      </div>
    )
  }
  if (!queue.data) {
    return <p role="status">Loading translations…</p>
  }
  const skipped = ordered.filter((a) => pass.skipped.includes(a.app_id))
  function finish(id: string) {
    setFinished((previous) => [...previous, id])
    setPass((previous) => ({
      current: activeApp.current === id ? "" : previous.current,
      skipped: previous.skipped.filter((skippedId) => skippedId !== id),
    }))
  }
  return (
    <>
      {queue.isRefetchError && (
        <p role="alert">
          Could not refresh the queue. Showing the last loaded apps.
        </p>
      )}
      {queue.data.indexing && (
        <p role="status" className="text-sm text-muted-foreground">
          Flathub is still checking other apps.
        </p>
      )}
      {ordered.length > 0 && (
        <AppPicker groups={groups} language={language} appId={appId} />
      )}
      {app ? (
        <MetadataTranslationEditor
          key={app.app_id}
          appId={app.app_id}
          queue={{
            language,
            name: app.name,
            finishInBackground: () => {
              if (activeApp.current !== app.app_id) {
                finish(app.app_id)
              }
            },
            advance: (skip) => {
              const stillActive = activeApp.current === app.app_id
              if (stillActive) {
                updateAddress()
              }
              if (skip) {
                setPass((previous) => ({
                  current: stillActive ? "" : previous.current,
                  skipped: [...new Set([...previous.skipped, app.app_id])],
                }))
              } else {
                finish(app.app_id)
              }
            },
          }}
        />
      ) : requested ? (
        <div role="status" className="space-y-2">
          <p className="break-words">
            {requested} is not in this translation queue.
          </p>
          {isValidAppId(requested) && (
            <p>
              <Link
                className="underline"
                href={`/apps/${requested}/translate?language=${encodeURIComponent(language)}`}
              >
                Open the translation editor for {requested}
              </Link>
            </p>
          )}
          <Button variant="outline" onClick={() => updateAddress()}>
            Return to queue
          </Button>
        </div>
      ) : (
        <div className="space-y-3" role="status">
          {skipped.length > 0 ? (
            <p>You skipped the remaining apps in this queue.</p>
          ) : !queue.data.indexing ? (
            <p>No more apps in this queue.</p>
          ) : null}
          <Button
            variant="outline"
            disabled={queue.isFetching}
            onClick={refreshQueue}
          >
            Refresh queue
          </Button>
          {skipped.length > 0 && (
            <Button variant="outline" onClick={() => setPass(emptyPass)}>
              Revisit skipped apps ({skipped.length})
            </Button>
          )}
        </div>
      )}
      {queue.data.attention.length > 0 && (
        <details>
          <summary>Needs attention ({queue.data.attention.length})</summary>
          <ul>
            {queue.data.attention.map((a) => (
              <li key={a.app_id}>
                <Link
                  className="underline"
                  href={`/apps/${a.app_id}/translate?language=${encodeURIComponent(language)}`}
                >
                  {a.name}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  )
}
