"use client"

import { useEffect, useRef, useState } from "react"
import { useLocale } from "next-intl"
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import type { AxiosResponse } from "axios"
import { isAxiosError } from "axios"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleIcon,
  EyeIcon,
  GitPullRequestIcon,
  LanguagesIcon,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { sanitizeAppstreamDescription } from "@/lib/helpers"
import {
  saveListingTranslationsMetadataTranslationsAppIdPost,
  dismissRecoveredTranslationMetadataTranslationsAppIdDismissPost,
  getTranslationSourceMetadataTranslationsAppIdGet,
  rebaseTranslationSourceMetadataTranslationsAppIdRebasePost,
} from "src/codegen/metadata-translations/metadata-translations"
import type { TranslationSource } from "src/codegen/model/translationSource"
import type { TranslationUnit } from "src/codegen/model/translationUnit"
import type { SharedTranslationUnit } from "src/codegen/model/sharedTranslationUnit"
import { Permission } from "src/codegen/model/permission"
import { useUserContext } from "src/context/user-info"
import { Link } from "src/i18n/navigation"
import LoginGuard from "../login/LoginGuard"
import Spinner from "../Spinner"
import { metadataTranslationText as t } from "./MetadataTranslationEditor.messages"
import {
  discardTranslationDrafts,
  hasTranslationDrafts,
  useTranslationDrafts,
} from "./translationDrafts"

const workspaceStyles =
  "[--muted-foreground:var(--flathub-granite-gray)] [--primary:var(--flathub-celestial-blue-dark)] dark:scheme-dark dark:[--muted-foreground:var(--flathub-gray-x11)] dark:[--primary:var(--flathub-celestial-blue-light)] dark:[--primary-foreground:var(--flathub-dark-gunmetal)] [&_p]:mb-0 [&_p]:leading-[1.6] [&_[data-icon]]:size-4"

function errorCode(error: unknown): string {
  if (isAxiosError(error) && typeof error.response?.data?.detail === "string") {
    return error.response.data.detail
  }
  return "request_failed"
}

export default function MetadataTranslationEditor({
  appId,
  queue,
  initialLanguage,
}: {
  appId: string
  initialLanguage?: string
  queue?: { language: string; name: string; advance: (skip: boolean) => void }
}) {
  const uiLocale = useLocale()
  const user = useUserContext()
  const isAdmin = user.info?.permissions?.includes(Permission["manage-apps"])
  const account = user.info?.default_account
  const userKey = account ? `${account.provider}:${account.login}` : ""
  const [language, setLanguage] = useState(
    initialLanguage ?? (uiLocale.startsWith("en") ? "" : uiLocale),
  )
  const [selectedLanguage, setSelectedLanguage] = useState(
    queue?.language ?? initialLanguage ?? "",
  )
  const [dirty, setDirty] = useState(false)
  const draftKey = userKey && JSON.stringify([userKey, appId, selectedLanguage])
  const confirmDiscard = () =>
    (!dirty && !hasTranslationDrafts(draftKey)) ||
    window.confirm(t("discard-unsaved"))
  const queryClient = useQueryClient()
  const queryKey = ["listing-translations", appId, selectedLanguage, userKey]
  const dismissalKey = ["dismiss-listing-translation", ...queryKey]
  const saveKey = ["save-listing-translation", ...queryKey]
  const isSaving = useIsMutating({ mutationKey: saveKey, exact: true }) > 0
  const isDismissing =
    useIsMutating({ mutationKey: dismissalKey, exact: true }) > 0
  const query = useQuery({
    queryKey,
    queryFn: () =>
      getTranslationSourceMetadataTranslationsAppIdGet(
        appId,
        { locale: selectedLanguage },
        { withCredentials: true },
      ),
    enabled: Boolean(selectedLanguage && isAdmin),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  return (
    <LoginGuard
      condition={(info) =>
        info.permissions?.includes(Permission["manage-apps"])
      }
    >
      <section
        data-translation-workspace
        className={cn(
          workspaceStyles,
          "flex flex-col",
          queue
            ? "gap-5"
            : "mx-auto w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 sm:py-12",
        )}
      >
        {queue ? (
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold">{queue.name}</h2>
              {queue.name !== appId && (
                <p className="text-sm text-muted-foreground">{appId}</p>
              )}
            </div>
            <Button
              variant="outline"
              disabled={isSaving || isDismissing}
              onClick={() => {
                if (confirmDiscard()) {
                  discardTranslationDrafts(draftKey)
                  queue.advance(true)
                }
              }}
            >
              Skip app
            </Button>
          </header>
        ) : (
          <>
            <Link
              href={`/apps/${appId}`}
              className="flex items-center gap-2 self-start break-all text-sm underline-offset-4 hover:underline"
            >
              <ArrowLeftIcon
                className="size-4 shrink-0 rtl:rotate-180"
                aria-hidden
              />
              {appId}
            </Link>
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-12">
              <header className="flex max-w-2xl flex-col gap-3">
                <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                  {t("title")}
                </h1>
                <p className="text-muted-foreground">{t("intro")}</p>
              </header>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  if (isDismissing || isSaving) {
                    return
                  }
                  if (!confirmDiscard()) {
                    return
                  }
                  discardTranslationDrafts(draftKey)
                  if (language.trim() === selectedLanguage) {
                    void query.refetch()
                  } else {
                    setSelectedLanguage(language.trim())
                  }
                }}
                className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5"
              >
                <Field>
                  <FieldLabel htmlFor="translation-language">
                    {t("language")}
                  </FieldLabel>
                  <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <Input
                      variant="surface"
                      id="translation-language"
                      value={language}
                      onChange={(event) => setLanguage(event.target.value)}
                      placeholder="de, pt_BR, ar"
                      pattern={String.raw`[a-z]{2,3}([\-_][A-Za-z0-9]{2,8})*(@[a-z]+)?`}
                      maxLength={40}
                      required
                      autoCapitalize="none"
                      spellCheck={false}
                      aria-describedby="translation-language-help"
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      size="lg"
                      disabled={query.isFetching || isDismissing || isSaving}
                    >
                      <LanguagesIcon data-icon="inline-start" />
                      {t("load")}
                    </Button>
                  </div>
                  <p
                    className="text-sm text-muted-foreground"
                    id="translation-language-help"
                  >
                    {t("language-help")}
                  </p>
                </Field>
              </form>
            </div>
          </>
        )}
        {query.isFetching && <Spinner size="m" />}
        {query.error && (
          <TranslationError code={errorCode(query.error)} appId={appId} />
        )}
        {queue &&
        query.data &&
        !query.data.data.batch_error &&
        !query.data.data.units.some((u) => !u.translation.trim()) &&
        !dirty &&
        !hasTranslationDrafts(draftKey) ? (
          <div className="space-y-3">
            <p>This listing is already translated.</p>
            <Button onClick={() => queue.advance(false)}>
              Continue to next app
            </Button>
          </div>
        ) : (
          query.data && (
            <TranslationForm
              key={`${userKey}:${query.data.data.locale}:${query.data.data.revision}:${query.dataUpdatedAt}`}
              appId={appId}
              draftKey={draftKey}
              source={query.data.data}
              onNextApp={queue && (() => queue.advance(false))}
              dismissalKey={dismissalKey}
              saveKey={saveKey}
              isReloading={query.isFetching}
              onRecovered={() => query.refetch()}
              onDirtyChange={setDirty}
              onSharedSave={(result) =>
                queryClient.setQueryData<AxiosResponse<TranslationSource>>(
                  queryKey,
                  (current) =>
                    current && {
                      ...current,
                      data: {
                        ...current.data,
                        units: result.units,
                        batch_state: result.state,
                        batch_error: null,
                        pull_request_url: result.url,
                      },
                    },
                  {
                    updatedAt:
                      queryClient.getQueryState(queryKey)?.dataUpdatedAt,
                  },
                )
              }
              onDismissed={async (previous_translations) => {
                await queryClient.cancelQueries({ queryKey, exact: true })
                queryClient.setQueryData<AxiosResponse<TranslationSource>>(
                  queryKey,
                  (current) =>
                    current && {
                      ...current,
                      data: { ...current.data, previous_translations },
                    },
                  // The form key includes this timestamp. Changing it would reset the editor.
                  {
                    updatedAt:
                      queryClient.getQueryState(queryKey)?.dataUpdatedAt,
                  },
                )
              }}
            />
          )
        )}
      </section>
    </LoginGuard>
  )
}

function TranslationError({ code, appId }: { code: string; appId: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle role="heading" aria-level={2}>
        {t("error-title")}
      </AlertTitle>
      <AlertDescription>
        <p>
          {t.has(`errors.${code}`)
            ? t(`errors.${code}`)
            : t("errors.request_failed")}
        </p>
        {[
          "metadata_not_found",
          "unsupported_metadata",
          "unsupported_repository",
        ].includes(code) && (
          <a href={`https://github.com/flathub/${appId}`} className="underline">
            {t("open-repository")}
          </a>
        )}
      </AlertDescription>
    </Alert>
  )
}

export function TranslationForm({
  draftKey,
  onNextApp,
  appId,
  source,
  onRecovered,
  onDirtyChange,
  onSharedSave,
  onDismissed,
  dismissalKey,
  saveKey,
  isReloading = false,
}: {
  appId: string
  source: TranslationSource
  draftKey?: string
  onNextApp?: () => void
  onRecovered?: () => Promise<unknown>
  onDirtyChange?: (value: boolean) => void
  onSharedSave?: (result: {
    units: SharedTranslationUnit[]
    state: string
    url?: string | null
  }) => void
  onDismissed?: (items: TranslationUnit[]) => Promise<void>
  dismissalKey?: string[]
  saveKey?: string[]
  isReloading?: boolean
}) {
  const uiLocale = useLocale()
  const languageTag = source.locale.replaceAll("_", "-").split("@")[0]
  let languageName = source.locale
  try {
    languageName =
      new Intl.DisplayNames([uiLocale], { type: "language" }).of(languageTag) ??
      source.locale
  } catch {
    // Preserve AppStream locale identifiers that Intl does not recognize.
  }
  const drafts = useTranslationDrafts(draftKey)
  const [selected, setSelected] = useState(() => {
    const restored = source.units.findIndex((u) => drafts.get(u))
    if (restored >= 0) {
      return restored
    }
    return onNextApp
      ? Math.max(
          0,
          source.units.findIndex((u) => !u.translation.trim()),
        )
      : 0
  })
  const [showList, setShowList] = useState(false)
  const unmatched = drafts.unmatched(source.units)
  const [latest, setLatest] = useState(source.units)
  const [conflicts, setConflicts] = useState<
    Record<string, SharedTranslationUnit>
  >({})
  const [preview, setPreview] = useState(false)
  const editor = useRef<HTMLTextAreaElement>(null)
  const unit = latest[selected]
  const draft = unit && drafts.get(unit)
  const value = draft?.text ?? unit?.translation ?? ""
  const changed = Boolean(unit && value.trim() !== unit.translation)
  const lastMissing =
    onNextApp && !latest.some((u) => u.id !== unit?.id && !u.translation.trim())
  const unsaved = unmatched.length > 0 || latest.some(drafts.isEdited)
  const translatedCount = latest.filter((item) =>
    item.translation.trim(),
  ).length
  const label = (field: string) =>
    t.has(`fields.${field}`) ? t(`fields.${field}`) : field
  const mutation = useMutation({
    mutationKey: saveKey,
    mutationFn: ({
      id,
      text,
      version,
    }: {
      id: string
      text: string
      version: string
      next: boolean
    }) =>
      saveListingTranslationsMetadataTranslationsAppIdPost(
        appId,
        {
          revision: source.revision,
          changes: { [id]: text },
          versions: { [id]: version },
        },
        { locale: source.locale },
        { withCredentials: true },
      ),
    onSuccess: ({ data }, { id, next }) => {
      setLatest(data.units)
      onSharedSave?.(data)
      drafts.discard(unit)
      if (onNextApp) {
        const anotherDraft = data.units.findIndex(
          (u) => u.id !== id && drafts.isEdited(u),
        )
        const missing = data.units.findIndex((u) => !u.translation.trim())
        if (anotherDraft >= 0) {
          setSelected(anotherDraft)
        } else if (missing >= 0) {
          setSelected(missing)
        } else {
          if (!unmatched.length) {
            onNextApp()
          }
        }
      } else if (next) {
        setSelected((current) => Math.min(current + 1, source.units.length - 1))
      }
      requestAnimationFrame(() => editor.current?.focus())
    },
    onError: (error, { id }) => {
      const detail = isAxiosError(error) && error.response?.data?.detail
      if (detail?.code === "text_conflict" && detail.unit?.id === id) {
        setConflicts((current) => ({ ...current, [id]: detail.unit }))
        setLatest((current) =>
          current.map((item) => (item.id === id ? detail.unit : item)),
        )
      }
    },
    retry: false,
  })
  const recovery = useMutation({
    mutationFn: () =>
      rebaseTranslationSourceMetadataTranslationsAppIdRebasePost(
        appId,
        { revision: source.revision },
        { locale: source.locale },
        { withCredentials: true },
      ),
    onSuccess: async () => {
      await onRecovered?.()
    },
    retry: false,
  })
  const dismissal = useMutation({
    mutationKey: dismissalKey,
    mutationFn: (item: TranslationUnit) =>
      dismissRecoveredTranslationMetadataTranslationsAppIdDismissPost(
        appId,
        item,
        { locale: source.locale },
        { withCredentials: true },
      ),
    onSuccess: ({ data }) => onDismissed?.(data),
    retry: false,
  })

  useEffect(() => {
    onDirtyChange?.(unsaved)
    return () => {
      onDirtyChange?.(false)
    }
  }, [onDirtyChange, unsaved])

  useEffect(() => {
    if (!unsaved) {
      return
    }
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    const beforeLink = (event: MouseEvent) => {
      if (
        event.button ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }
      const link =
        event.target instanceof Element ? event.target.closest("a[href]") : null
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.origin !== location.origin ||
        (link.target && link.target !== "_self") ||
        link.hasAttribute("download") ||
        (link.pathname === location.pathname && link.search === location.search)
      ) {
        return
      }
      if (!window.confirm(t("discard-unsaved"))) {
        event.preventDefault()
        event.stopPropagation()
      } else {
        discardTranslationDrafts(draftKey)
      }
    }
    document.addEventListener("click", beforeLink, true)
    const beforeExternalSubmit = (event: SubmitEvent) => {
      if (
        event.target instanceof Element &&
        !event.target.closest("[data-translation-workspace]") &&
        !window.confirm(t("discard-unsaved"))
      ) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    document.addEventListener("submit", beforeExternalSubmit, true)
    window.addEventListener("beforeunload", beforeUnload)
    return () => {
      document.removeEventListener("click", beforeLink, true)
      document.removeEventListener("submit", beforeExternalSubmit, true)
      window.removeEventListener("beforeunload", beforeUnload)
    }
  }, [unsaved, draftKey])

  function selectUnit(index: number) {
    setSelected(index)
    setShowList(false)
    if (mutation.isError) {
      mutation.reset()
    }
  }

  function save(next: boolean) {
    if (
      !unit ||
      !changed ||
      !source.can_submit ||
      isReloading ||
      recovery.isPending ||
      mutation.isPending ||
      conflicts[unit.id]
    ) {
      return
    }
    mutation.mutate({
      id: unit.id,
      text: value.trim(),
      version: draft?.version ?? unit.version,
      next,
    })
  }

  return (
    <section
      data-translation-workspace
      className={cn(workspaceStyles, "flex min-w-0 flex-col gap-5")}
      aria-label={t("editor")}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("language-heading", { language: languageName })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("translated-count", {
              count: translatedCount,
              total: source.units.length,
            })}
          </p>
        </div>
        {(mutation.data?.data.url || source.pull_request_url) && (
          <a
            href={
              mutation.data?.data.url || source.pull_request_url || undefined
            }
            className="flex items-center gap-2 text-sm underline underline-offset-4"
          >
            <GitPullRequestIcon className="size-4" aria-hidden />
            {t("view-contribution")}
          </a>
        )}
      </div>
      {unmatched.map(([id, draft]) => (
        <div key={id}>
          <p>Draft for a changed text</p>
          <p dir="auto">{draft.source}</p>
          <p dir="auto">{draft.text}</p>
          <Button variant="outline" onClick={() => drafts.discard(id)}>
            Dismiss draft
          </Button>
        </div>
      ))}
      {(source.batch_error === "source_changed" ||
        source.batch_error === "pull_request_closed") && (
        <Alert>
          <AlertTitle role="heading" aria-level={2}>
            {t(
              source.batch_error === "pull_request_closed"
                ? "pull-request-closed"
                : "source-changed",
            )}
          </AlertTitle>
          <AlertDescription>
            <p>
              {t(
                source.batch_error === "pull_request_closed"
                  ? "restart-help"
                  : "recovery-help",
              )}
            </p>
            {unsaved && <p>{t("recovery-unsaved")}</p>}
            <Button
              variant="outline"
              disabled={
                (unsaved && !draftKey) ||
                mutation.isPending ||
                isReloading ||
                recovery.isPending ||
                dismissal.isPending ||
                !onRecovered
              }
              onClick={() => recovery.mutate()}
            >
              {t(
                source.batch_error === "pull_request_closed"
                  ? "restart"
                  : "recover",
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {source.batch_error === "source_unavailable" && (
        <TranslationError code="source_unavailable" appId={appId} />
      )}
      {recovery.error && (
        <TranslationError code={errorCode(recovery.error)} appId={appId} />
      )}
      {dismissal.error && (
        <TranslationError code={errorCode(dismissal.error)} appId={appId} />
      )}
      {!!source.previous_translations?.length && (
        <details className="rounded-xl border bg-card p-4">
          <summary className="cursor-pointer font-semibold">
            {t("previous-translations")}
          </summary>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("previous-help")}
          </p>
          <div className="mt-4 flex flex-col gap-4">
            {source.previous_translations.map((item, index) => (
              <div
                key={`${item.id}:${index}`}
                className="min-w-0 border-t pt-4"
              >
                <h3 className="font-medium">{label(item.field)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("original-text")}
                </p>
                <p dir="auto" className="whitespace-pre-wrap break-words">
                  {item.source}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("translation-label", { language: languageName })}
                </p>
                <p dir="auto" className="whitespace-pre-wrap break-words">
                  {item.translation || t("removed-translation")}
                </p>
                <Button
                  className="mt-2"
                  variant="outline"
                  size="sm"
                  disabled={
                    !onDismissed ||
                    isReloading ||
                    unsaved ||
                    mutation.isPending ||
                    dismissal.isPending ||
                    recovery.isPending
                  }
                  onClick={() => {
                    if (window.confirm(t("dismiss-recovered-confirm"))) {
                      dismissal.mutate(item)
                    }
                  }}
                >
                  {t("dismiss-recovered")}
                </Button>
              </div>
            ))}
          </div>
        </details>
      )}
      <div className="grid min-w-0 overflow-hidden rounded-xl border bg-card md:grid-cols-[15rem_minmax(0,1fr)]">
        <div className="min-w-0 border-b border-border bg-muted/40 md:border-e md:border-b-0">
          <div className="p-4 md:hidden">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowList(!showList)}
              aria-expanded={showList}
              aria-controls="translation-unit-navigation"
            >
              {t("browse-fields")}
              <ChevronDownIcon data-icon="inline-end" />
            </Button>
          </div>
          <nav
            id="translation-unit-navigation"
            aria-label={t("browse-fields")}
            className={cn(
              "max-h-64 overflow-y-auto md:max-h-[42rem]",
              !showList && "hidden md:block",
            )}
          >
            <ol className="flex flex-col p-2">
              {latest.map((item, index) => {
                const stored = item.translation
                const edited = drafts.isEdited(item)
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 rounded-lg border-s-[3px] border-s-transparent px-3 py-3 text-start text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:opacity-50 aria-[current=true]:border-s-primary aria-[current=true]:bg-card"
                      aria-current={selected === index ? "true" : undefined}
                      disabled={mutation.isPending}
                      onClick={() => selectUnit(index)}
                    >
                      <span className="mt-0.5 shrink-0">
                        {stored ? (
                          <CheckIcon className="size-4" aria-hidden />
                        ) : (
                          <CircleIcon className="size-4" aria-hidden />
                        )}
                        <span className="sr-only">
                          {edited
                            ? t("not-saved")
                            : stored
                              ? t("translated")
                              : t("untranslated")}
                        </span>
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-sm font-semibold">
                          {label(item.field)}
                          {item.context ? ` (${item.context})` : ""}
                          {edited ? " *" : ""}
                        </span>
                        <span
                          className="truncate text-xs text-muted-foreground"
                          lang="en"
                        >
                          {item.source}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>
        </div>
        <div className="@container flex min-w-0 flex-col">
          {unit ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
                <div className="flex flex-col gap-1">
                  <h3 className="text-xl font-semibold tracking-tight">
                    {label(unit.field)}
                    {unit.context ? ` (${unit.context})` : ""}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {t("field-position", {
                      current: selected + 1,
                      total: source.units.length,
                    })}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("previous-field")}
                    disabled={selected === 0 || mutation.isPending}
                    onClick={() => selectUnit(selected - 1)}
                  >
                    <ArrowLeftIcon
                      data-icon="inline-start"
                      className="rtl:rotate-180"
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("next-field")}
                    disabled={
                      selected === source.units.length - 1 || mutation.isPending
                    }
                    onClick={() => selectUnit(selected + 1)}
                  >
                    <ArrowRightIcon
                      data-icon="inline-start"
                      className="rtl:rotate-180"
                    />
                  </Button>
                </div>
              </div>
              <Separator />
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  save(selected < source.units.length - 1)
                }}
                className="flex flex-col gap-6 p-5 sm:p-8"
              >
                <div className="flex flex-col gap-1.5 border-s-2 border-primary/50 ps-4">
                  <span className="text-sm text-muted-foreground">
                    {t("original-text")}
                  </span>
                  <p
                    id="translation-original"
                    className="max-w-prose whitespace-pre-wrap break-words text-xl leading-snug font-medium"
                    lang="en"
                    dir="ltr"
                  >
                    {unit.source}
                  </p>
                </div>
                <FieldGroup>
                  <Field data-disabled={mutation.isPending}>
                    {conflicts[unit.id] && (
                      <h4 role="alert" className="font-semibold">
                        {t("text-conflict")}
                      </h4>
                    )}
                    <div
                      className={cn(
                        "grid gap-4",
                        conflicts[unit.id] && "@min-[34rem]:grid-cols-2",
                      )}
                    >
                      <div className="flex min-w-0 flex-col gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <FieldLabel htmlFor="translation-text">
                            {conflicts[unit.id]
                              ? t("your-draft")
                              : t("translation-label", {
                                  language: languageName,
                                })}
                          </FieldLabel>
                          {changed && (
                            <Badge variant="outline">{t("not-saved")}</Badge>
                          )}
                        </div>
                        <Textarea
                          readOnly={
                            isReloading ||
                            recovery.isPending ||
                            !source.can_submit
                          }
                          ref={editor}
                          variant="surface"
                          className="min-h-24 w-full"
                          id="translation-text"
                          value={value}
                          lang={languageTag}
                          dir="auto"
                          rows={unit.markup ? 5 : 3}
                          maxLength={20000}
                          placeholder={t("translation-placeholder", {
                            language: languageName,
                          })}
                          aria-describedby={
                            unit.markup || unit.field === "keywords"
                              ? "translation-original translation-format-help"
                              : "translation-original"
                          }
                          disabled={mutation.isPending}
                          onChange={(event) => {
                            const text = event.target.value
                            drafts.edit(unit, text)
                            if (mutation.isError) {
                              mutation.reset()
                            }
                          }}
                          onKeyDown={(event) => {
                            if (
                              (event.ctrlKey || event.metaKey) &&
                              event.key === "Enter"
                            ) {
                              event.preventDefault()
                              if (source.can_submit && !mutation.isPending) {
                                save(selected < source.units.length - 1)
                              }
                            }
                          }}
                        />
                      </div>
                      {conflicts[unit.id] && (
                        <div className="flex min-w-0 flex-col gap-2">
                          <span className="text-sm font-medium">
                            {t("current-translation")}
                          </span>
                          <div className="flex flex-1 flex-col justify-between gap-3 rounded-lg bg-muted px-3 py-2">
                            <p
                              lang={languageTag}
                              dir="auto"
                              className="whitespace-pre-wrap break-words"
                            >
                              {conflicts[unit.id].translation ||
                                t("removed-translation")}
                            </p>
                            {conflicts[unit.id].last_editor_id != null && (
                              <p className="text-xs text-muted-foreground">
                                {t("last-editor", {
                                  id: String(conflicts[unit.id].last_editor_id),
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {!conflicts[unit.id] && unit.last_editor_id != null && (
                      <p className="text-sm text-muted-foreground">
                        {t("last-editor", { id: String(unit.last_editor_id) })}
                      </p>
                    )}
                    {conflicts[unit.id] && (
                      <div className="flex flex-wrap gap-2">
                        {([true, false] as const).map((keepDraft) => (
                          <Button
                            key={String(keepDraft)}
                            type="button"
                            variant={keepDraft ? "default" : "outline"}
                            onClick={() => {
                              if (keepDraft) {
                                drafts.edit(
                                  unit,
                                  value,
                                  conflicts[unit.id].version,
                                )
                              } else {
                                drafts.discard(unit)
                              }
                              setConflicts((current) => {
                                const updated = { ...current }
                                delete updated[unit.id]
                                return updated
                              })
                              mutation.reset()
                              editor.current?.focus()
                            }}
                          >
                            {t(keepDraft ? "keep-draft" : "use-saved")}
                          </Button>
                        ))}
                      </div>
                    )}
                    {(unit.markup || unit.field === "keywords") && (
                      <p
                        id="translation-format-help"
                        className="text-xs text-muted-foreground"
                      >
                        {unit.field === "keywords"
                          ? t("keywords-help")
                          : t("markup-help")}
                      </p>
                    )}
                  </Field>
                </FieldGroup>
                <div className="grid grid-cols-2 items-center gap-3 sm:flex sm:flex-wrap">
                  <Button
                    type="submit"
                    size="lg"
                    className="col-span-2"
                    disabled={
                      !source.can_submit ||
                      !changed ||
                      Boolean(conflicts[unit.id]) ||
                      mutation.isPending ||
                      recovery.isPending ||
                      isReloading
                    }
                  >
                    {mutation.isPending
                      ? t("saving")
                      : lastMissing
                        ? "Save and open next app"
                        : !onNextApp && selected === source.units.length - 1
                          ? t("save")
                          : t("save-next")}
                    <ArrowRightIcon
                      data-icon="inline-end"
                      className="rtl:rotate-180"
                    />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={
                      selected === source.units.length - 1 || mutation.isPending
                    }
                    onClick={() => selectUnit(selected + 1)}
                  >
                    {t("skip")}
                  </Button>
                  <Button
                    type="button"
                    variant={preview ? "selected" : "outline"}
                    className="sm:ms-auto"
                    aria-pressed={preview}
                    onClick={() => setPreview(!preview)}
                  >
                    <EyeIcon data-icon="inline-start" />
                    {t("preview")}
                  </Button>
                </div>
                {preview && (
                  <div className="flex flex-col gap-2 rounded-lg bg-muted p-4">
                    <span className="text-xs font-semibold">
                      {t("preview-label")}
                    </span>
                    <div dir="auto" lang={value ? languageTag : "en"}>
                      {unit.markup ? (
                        <div
                          dangerouslySetInnerHTML={{
                            __html: sanitizeAppstreamDescription(
                              value || unit.source,
                            ),
                          }}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap break-words">
                          {value || unit.source}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {source.batch_error &&
                  source.batch_error !== "source_unavailable" &&
                  !mutation.isSuccess && (
                    <Alert variant="destructive" className="text-foreground">
                      <AlertTitle role="heading" aria-level={2}>
                        {t("batch-failed")}
                      </AlertTitle>
                      <AlertDescription>
                        {t.has(`errors.${source.batch_error}`)
                          ? t(`errors.${source.batch_error}`)
                          : t("errors.request_failed")}
                      </AlertDescription>
                    </Alert>
                  )}
                {mutation.error && !conflicts[unit.id] && (
                  <TranslationError
                    code={errorCode(mutation.error)}
                    appId={appId}
                  />
                )}
                {!source.can_submit && !source.batch_error && (
                  <Alert>
                    <AlertTitle role="heading" aria-level={2}>
                      {t("saving-unavailable")}
                    </AlertTitle>
                    <AlertDescription>
                      {t("submission-unavailable")}
                    </AlertDescription>
                  </Alert>
                )}
                <p className="text-sm text-muted-foreground" role="status">
                  {mutation.isSuccess && !changed
                    ? t("saved")
                    : source.batch_state === "queued"
                      ? t("queued")
                      : t("automatic-pr-help")}
                </p>
              </form>
            </>
          ) : (
            <p className="p-8">{t("no-fields")}</p>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2 text-xs text-muted-foreground">
        <p>{t("editing-help")}</p>
        <p>
          {t("license", {
            license: source.metadata_license || t("license-missing"),
          })}
        </p>
        <a
          href={source.source_url}
          className="self-start break-all underline underline-offset-4"
        >
          {source.path}
        </a>
      </div>
    </section>
  )
}
