"use client"

import { useEffect, useState } from "react"
import { useLocale } from "next-intl"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getLanguageName, languages } from "src/localize"
import { Link, useRouter } from "src/i18n/navigation"
import { useUserContext } from "src/context/user-info"
import { Permission } from "src/codegen/model/permission"
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
  const allowed = user.info?.permissions.includes(Permission["manage-apps"])
  const account = user.info?.default_account
  const [last] = useState(
    () =>
      readPreference("app-translations.language") ||
      (locale === "en" ? "" : locale),
  )
  const [choice, setChoice] = useState(
    last && !languages.some((l) => l === last) ? "other" : last,
  )
  const [custom, setCustom] = useState(choice === "other" ? last : "")
  useEffect(() => {
    if (language) {
      writePreference("app-translations.language", language)
    }
  }, [language])
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">App translations</h1>
      </header>
      {!allowed ? (
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
          className="max-w-lg space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            router.push(
              `/app-translations/${encodeURIComponent((choice === "other" ? custom : choice).replaceAll("_", "-"))}`,
            )
          }}
        >
          <label htmlFor="queue-language">
            Choose a language to translate app listings.
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="min-h-10 min-w-40 flex-1 rounded-md border bg-card px-3 text-foreground"
              id="queue-language"
              value={choice}
              required
              onChange={(e) => setChoice(e.target.value)}
            >
              <option value="" disabled>
                Select a language
              </option>
              {languages
                .filter((l) => l !== "en")
                .sort((a, b) =>
                  getLanguageName(a).localeCompare(getLanguageName(b), locale),
                )
                .map((l) => (
                  <option key={l} value={l}>
                    {getLanguageName(l)}
                  </option>
                ))}
              <option value="other">Another language…</option>
            </select>
            {choice === "other" && (
              <Input
                aria-label="Language code"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                required
                maxLength={40}
                pattern={String.raw`[a-z]{2,3}([\-_][A-Za-z0-9]{2,8})*(@[a-z]+)?`}
                placeholder="Language code, e.g. ast"
              />
            )}
            <Button type="submit">Continue</Button>
          </div>
        </form>
      )}
      <p className="text-sm">
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

function Queue({ language, account }: { language: string; account: string }) {
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
    retry: false,
  })
  const available =
    queue.data?.apps.filter(
      (a) => !pass.skipped.includes(a.app_id) && !finished.includes(a.app_id),
    ) ?? []
  const app = available.find((a) => a.app_id === pass.current) ?? available[0]
  useEffect(() => {
    writePreference(
      storageKey,
      JSON.stringify({ ...pass, current: app?.app_id ?? pass.current }),
    )
  }, [app?.app_id, pass, storageKey])
  if (queue.isError) {
    return (
      <div role="alert">
        Could not load app translations.{" "}
        <Button variant="outline" onClick={() => void queue.refetch()}>
          Try again
        </Button>
      </div>
    )
  }
  if (!queue.data) {
    return <p role="status">Loading translations…</p>
  }
  const skipped = queue.data.apps.filter((a) => pass.skipped.includes(a.app_id))
  return (
    <>
      {app ? (
        <MetadataTranslationEditor
          key={app.app_id}
          appId={app.app_id}
          queue={{
            language,
            name: app.name,
            advance: (skip) => {
              if (!skip) {
                setFinished((previous) => [...previous, app.app_id])
              }
              setPass({
                current:
                  available.find((a) => a.app_id !== app.app_id)?.app_id ?? "",
                skipped: skip ? [...pass.skipped, app.app_id] : pass.skipped,
              })
            },
          }}
        />
      ) : (
        <div className="space-y-3" role="status">
          <p>
            {skipped.length
              ? "You skipped the remaining apps in this queue."
              : queue.data.indexing
                ? "Flathub is still checking other apps."
                : "No more apps in this queue."}
          </p>
          <Button
            variant="outline"
            disabled={queue.isFetching}
            onClick={() => void queue.refetch()}
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
