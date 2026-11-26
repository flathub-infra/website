"use client"

import { useState } from "react"
import { useFormatter, useLocale } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import TranslationLanguageSelect from "src/components/application/TranslationLanguageSelect"
import { resolveTranslationLanguage } from "src/components/application/translationLanguages"
import { useGetListingCheckMetadataTranslationsIndexStatusAppIdGet } from "src/codegen/metadata-translations/metadata-translations"
import type { TranslationLookup } from "src/codegen/model/translationLookup"
import type { Language } from "src/localize"

function checkOutcome({ outcome, http_status }: TranslationLookup) {
  switch (outcome) {
    case "github_error":
      return http_status
        ? `GitHub returned HTTP ${http_status}.`
        : "The worker could not reach GitHub."
    case "ambiguous_translations":
      return "The worker could not match translations in this language to their source text."
    case "indexed":
      return "The worker indexed the listing."
    case "no_editable_metadata":
      return "The worker found no editable recipe metadata."
    case "verification_failed":
      return "The worker could not verify the published listing."
    default:
      return "No outcome was recorded for this check."
  }
}

function LookupResult({
  appId,
  language,
}: {
  appId: string
  language: Language
}) {
  const format = useFormatter()
  const lookup = useGetListingCheckMetadataTranslationsIndexStatusAppIdGet(
    appId,
    { locale: language },
    { axios: { withCredentials: true }, query: { refetchInterval: 60_000 } },
  )
  if (lookup.isError) {
    return (
      <p role="alert">
        Could not load the check for {appId}.{" "}
        <button className="underline" onClick={() => lookup.refetch()}>
          Try again
        </button>
      </p>
    )
  }
  const data = lookup.data?.data
  if (!data) {
    return <p role="status">Looking up {appId}…</p>
  }
  const name = new Intl.DisplayNames("en", { type: "language" }).of(language)
  let reason
  if (data.eligibility === "unknown") {
    reason = "No app with this ID is in the catalog."
  } else if (data.eligibility === "eol") {
    reason = "The catalog marks this app as end of life. The worker skips it."
  } else if (data.eligibility === "excluded") {
    reason = "This app is outside the translation index."
  } else if (!data.checked_at) {
    reason = "Waiting for a first check."
  }
  return (
    <div
      role="status"
      className="space-y-2 border-s-4 border-primary bg-card px-4 py-3"
    >
      <h3 className="break-words font-semibold [overflow-wrap:anywhere]">
        {appId}
      </h3>
      {reason && <p>{reason}</p>}
      {data.queue_state === "attention" ? (
        <p>
          See <strong>Needs attention</strong> in the {name} queue.
        </p>
      ) : data.queue_state === "listed" ? (
        <p>
          This listing has {data.missing}{" "}
          {data.missing === 1 ? "text" : "texts"} to translate into {name}.
        </p>
      ) : (
        data.eligibility === "eligible" &&
        data.checked_at && (
          <p>
            {data.missing === 0 && data.outcome === "indexed"
              ? `The index has no listing text left to translate into ${name}.`
              : `This app is not in the ${name} queue.`}
          </p>
        )
      )}
      {data.checked_at && (
        <div className="mt-3 border-t pt-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="font-semibold">Last recorded check</span>
            <time dateTime={data.checked_at}>
              {format.dateTime(new Date(data.checked_at), {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "UTC",
              })}{" "}
              UTC
            </time>
          </div>
          <p className="text-muted-foreground">{checkOutcome(data)}</p>
        </div>
      )}
    </div>
  )
}

export default function ListingLookup() {
  const locale = useLocale()
  const [appId, setAppId] = useState("")
  const [language, setLanguage] = useState<string>(
    resolveTranslationLanguage(locale) ?? "",
  )
  const [selection, setSelection] = useState<{
    appId: string
    language: Language
  }>()
  return (
    <section aria-labelledby="lookup-title" className="space-y-4">
      <div>
        <h2 id="lookup-title" className="text-xl font-semibold">
          Look up an app
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Check why a listing is missing from a language queue.
        </p>
      </div>
      <form
        className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_auto] [&_select]:h-12"
        onSubmit={(event) => {
          event.preventDefault()
          const chosen = resolveTranslationLanguage(language)
          if (chosen) {
            setSelection({ appId: appId.trim(), language: chosen })
          }
        }}
      >
        <div className="grid min-w-0 grow gap-1">
          <label htmlFor="lookup-app-id">App ID</label>
          <Input
            id="lookup-app-id"
            required
            minLength={6}
            maxLength={255}
            pattern={String.raw`[A-Za-z_][\w.\-]+`}
            title="Enter an app ID such as net.filebot.FileBot."
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            placeholder="net.filebot.FileBot"
          />
        </div>
        <div className="grid min-w-0 gap-1">
          <label htmlFor="lookup-language">Language</label>
          <TranslationLanguageSelect
            id="lookup-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          />
        </div>
        <Button className="h-12" type="submit">
          Look up app
        </Button>
      </form>
      {selection && <LookupResult {...selection} />}
    </section>
  )
}
