"use client"

import axios from "axios"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import {
  FormEvent,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import AdminLayoutClient from "src/components/AdminLayoutClient"
import LogoImage from "src/components/LogoImage"
import Spinner from "src/components/Spinner"
import { useUserContext } from "src/context/user-info"
import {
  createCuratedAppSelectionAdminAppPicksAdminCuratedAppSelectionsPost,
  deleteCuratedAppSelectionAdminAppPicksAdminCuratedAppSelectionsSelectionIdDelete,
  getCuratedAppSelectionThemesAdminAppPicksAdminCuratedAppSelectionThemesGet,
  getCuratedAppSelectionsAdminAppPicksAdminCuratedAppSelectionsGet,
  getAppPickRecommendationsQualityModerationAppPickRecommendationsGet,
  getAppstreamAppstreamAppIdGet,
  GetUserinfoAuthUserinfoGet200,
  Permission,
  ScheduledSelectionAdmin,
  ScheduledSelectionInput,
  updateCuratedAppSelectionAdminAppPicksAdminCuratedAppSelectionsSelectionIdPut,
} from "src/codegen"
import {
  HOMEPAGE_CURATED_APP_SELECTION_LAYOUTS,
  HOMEPAGE_CURATED_APP_SELECTION_SLOTS,
  type HomepageCuratedAppSelectionLayout,
  type HomepageCuratedAppSelectionSlot,
} from "src/types/CuratedAppSelection"
import { getUtcDateString } from "src/utils/date"
import {
  canReplaceDirtyForm,
  createFormResetState,
  createInitialForm,
  isSelectionFormDirty,
  matchesAppSearch,
  partitionAndSortSelections,
  resolveThemeLabel,
  type SelectableApp,
  type SelectionFormState,
  type ThemeLabel,
} from "./homepage-selections"

const SLOT_LABELS: Record<HomepageCuratedAppSelectionSlot, string> = {
  "after-hero": "After hero",
  "after-top-apps": "After Top Apps",
  "after-first-category-block": "After first category block",
}

const LAYOUT_LABELS: Record<HomepageCuratedAppSelectionLayout, string> = {
  grid: "Grid",
  carousel: "Carousel",
}

const FIELD_CLASS =
  "h-12 w-full rounded-xl border border-input bg-flathub-gainsborow px-3 text-sm shadow-xs dark:bg-stone-900"
const SELECT_TRIGGER_CLASS = `${FIELD_CLASS} mt-2 text-flathub-dark-gunmetal hover:bg-flathub-gainsborow data-[state=open]:bg-flathub-gainsborow dark:text-flathub-lotion dark:hover:bg-stone-900 dark:data-[state=open]:bg-stone-900 [&>svg]:text-flathub-granite-gray dark:[&>svg]:text-flathub-gainsborow`
const SELECT_CONTENT_CLASS =
  "z-50 border-input bg-flathub-white text-flathub-dark-gunmetal shadow-xl dark:bg-stone-900 dark:text-flathub-lotion"
const SELECT_ITEM_CLASS =
  "cursor-pointer text-flathub-dark-gunmetal hover:bg-flathub-celestial-blue hover:text-flathub-white focus:bg-flathub-celestial-blue focus:text-flathub-white data-[highlighted]:bg-flathub-celestial-blue data-[highlighted]:text-flathub-white dark:text-flathub-lotion"

type ScheduledSelectionView = Omit<
  ScheduledSelectionAdmin,
  "slot" | "layout"
> & {
  slot: HomepageCuratedAppSelectionSlot
  layout: HomepageCuratedAppSelectionLayout
  appDetails: SelectableApp[]
}

interface SaveSelectionVariables {
  selectionId?: number
  body: ScheduledSelectionInput
  appDetails: SelectableApp[]
}

function todayString() {
  return getUtcDateString()
}

function appFallback(appId: string): SelectableApp {
  return {
    id: appId,
    name: appId,
    subtitle: "Appstream data unavailable",
    icon: "",
    keywords: [],
  }
}

function toSelectionView(
  selection: ScheduledSelectionAdmin,
  appDetails: SelectableApp[],
): ScheduledSelectionView {
  const appDetailsById = new Map(appDetails.map((app) => [app.id, app]))
  const sortedApps = selection.apps
    .slice()
    .sort((a, b) => a.position - b.position)

  return {
    ...selection,
    slot: selection.slot as HomepageCuratedAppSelectionSlot,
    layout: selection.layout as HomepageCuratedAppSelectionLayout,
    apps: sortedApps,
    appDetails: sortedApps.map(
      (app) => appDetailsById.get(app.app_id) ?? appFallback(app.app_id),
    ),
  }
}

async function getSelectableApp(appId: string): Promise<SelectableApp> {
  try {
    const response = await getAppstreamAppstreamAppIdGet(appId, {
      locale: "en",
    })
    const appstream = response.data

    if (!("summary" in appstream) || typeof appstream.summary !== "string") {
      return appFallback(appId)
    }

    return {
      id: appstream.id,
      name: appstream.name,
      subtitle: appstream.summary,
      icon: "icon" in appstream && appstream.icon ? appstream.icon : "",
      keywords:
        "keywords" in appstream && Array.isArray(appstream.keywords)
          ? appstream.keywords
          : [],
    }
  } catch {
    return appFallback(appId)
  }
}

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === "string") {
      return detail
    }

    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => {
          if (typeof item === "string") {
            return item
          }

          if (item && typeof item === "object" && "msg" in item) {
            return String(item.msg)
          }

          return null
        })
        .filter((message): message is string => !!message)

      if (messages.length > 0) {
        return messages.join(" ")
      }
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return "An unexpected error occurred."
}

export default function HomepageSelectionsClient() {
  const t = useTranslations()
  const user = useUserContext()
  const queryClient = useQueryClient()
  const canModerate = !!user.info?.permissions.some(
    (permission) => permission === Permission["quality-moderation"],
  )

  const recommendationDate = todayString()
  const initialForm = useMemo(
    () => createInitialForm(recommendationDate),
    [recommendationDate],
  )
  const [form, setForm] = useState<SelectionFormState>(initialForm)
  const [pristineForm, setPristineForm] =
    useState<SelectionFormState>(initialForm)
  const [pickerResetGeneration, setPickerResetGeneration] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  const resetForm = (successMessage: string | null = null) => {
    const reset = createFormResetState(
      todayString(),
      pickerResetGeneration,
      successMessage,
    )
    setForm(reset.form)
    setPristineForm(reset.pristineForm)
    setPickerResetGeneration(reset.pickerResetGeneration)
    setFormError(reset.formError)
    setFormSuccess(reset.formSuccess)
  }

  const themesQuery = useQuery({
    queryKey: ["curated-app-selection-themes"],
    queryFn: async () => {
      const response =
        await getCuratedAppSelectionThemesAdminAppPicksAdminCuratedAppSelectionThemesGet(
          { withCredentials: true },
        )

      return response.data
    },
    enabled: canModerate,
  })

  const selectionsQuery = useQuery({
    queryKey: ["curated-app-selections-admin"],
    queryFn: async (): Promise<ScheduledSelectionView[]> => {
      const response =
        await getCuratedAppSelectionsAdminAppPicksAdminCuratedAppSelectionsGet({
          withCredentials: true,
        })
      const selections = response.data
      const appIds = Array.from(
        new Set(
          selections.flatMap((selection) =>
            selection.apps.map((app) => app.app_id),
          ),
        ),
      )
      const appDetails = await Promise.all(
        appIds.map(
          async (appId): Promise<[string, SelectableApp]> => [
            appId,
            await getSelectableApp(appId),
          ],
        ),
      )
      const appDetailsById = new Map(appDetails)

      return selections.map((selection) =>
        toSelectionView(
          selection,
          selection.apps.map(
            (app) => appDetailsById.get(app.app_id) ?? appFallback(app.app_id),
          ),
        ),
      )
    },
    enabled: canModerate,
  })

  const recommendationsQuery = useQuery({
    queryKey: ["curated-app-selection-recommendations", recommendationDate],
    queryFn: async (): Promise<SelectableApp[]> => {
      const recommendations =
        await getAppPickRecommendationsQualityModerationAppPickRecommendationsGet(
          { recommendation_date: recommendationDate },
          { withCredentials: true },
        )
      const apps = await Promise.allSettled(
        recommendations.data.recommendations.map((app) =>
          getSelectableApp(app.app_id),
        ),
      )

      return apps
        .filter(
          (result): result is PromiseFulfilledResult<SelectableApp> =>
            result.status === "fulfilled",
        )
        .map((result) => result.value)
        .sort((a, b) => a.name.localeCompare(b.name))
    },
    enabled: canModerate,
  })

  const themesById = useMemo(
    () => new Map((themesQuery.data ?? []).map((theme) => [theme.id, theme])),
    [themesQuery.data],
  )

  const themeLabelsById = useMemo(
    () =>
      new Map(
        (themesQuery.data ?? []).map((theme) => [
          theme.id,
          resolveThemeLabel(theme, t.has, t),
        ]),
      ),
    [t, themesQuery.data],
  )
  const availableApps = useMemo(() => {
    const selectedAppIds = new Set(form.apps.map((app) => app.id))
    return (recommendationsQuery.data ?? []).filter(
      (app) => !selectedAppIds.has(app.id),
    )
  }, [form.apps, recommendationsQuery.data])

  const partitionedSelections = useMemo(
    () =>
      partitionAndSortSelections(
        selectionsQuery.data ?? [],
        recommendationDate,
      ),
    [recommendationDate, selectionsQuery.data],
  )

  const saveSelection = useMutation({
    mutationFn: async ({ selectionId, body }: SaveSelectionVariables) => {
      if (selectionId) {
        const response =
          await updateCuratedAppSelectionAdminAppPicksAdminCuratedAppSelectionsSelectionIdPut(
            selectionId,
            body,
            { withCredentials: true },
          )

        return response.data
      }

      const response =
        await createCuratedAppSelectionAdminAppPicksAdminCuratedAppSelectionsPost(
          body,
          { withCredentials: true },
        )

      return response.data
    },
    onSuccess: async (selection, variables) => {
      const selectionView = toSelectionView(selection, variables.appDetails)
      queryClient.setQueryData<ScheduledSelectionView[]>(
        ["curated-app-selections-admin"],
        (currentSelections = []) => [
          selectionView,
          ...currentSelections.filter(
            (currentSelection) => currentSelection.id !== selectionView.id,
          ),
        ],
      )
      resetForm(
        variables.selectionId ? "Selection saved." : "Selection created.",
      )
      await queryClient.invalidateQueries({
        queryKey: ["curated-app-selections-admin"],
      })
    },
    onError: (error) => {
      setFormSuccess(null)
      setFormError(getErrorMessage(error))
    },
  })

  const deleteSelection = useMutation({
    mutationFn: async (selectionId: number) => {
      await deleteCuratedAppSelectionAdminAppPicksAdminCuratedAppSelectionsSelectionIdDelete(
        selectionId,
        { withCredentials: true },
      )
    },
    onSuccess: async (_data, selectionId) => {
      if (form.editingId === selectionId) {
        resetForm("Selection deleted.")
      } else {
        setFormError(null)
        setFormSuccess("Selection deleted.")
      }
      await queryClient.invalidateQueries({
        queryKey: ["curated-app-selections-admin"],
      })
    },
    onError: (error) => {
      setFormSuccess(null)
      setFormError(getErrorMessage(error))
    },
  })

  const addApp = (app: SelectableApp | null) => {
    if (!app) {
      return
    }

    setForm((current) => {
      if (current.apps.some((selectedApp) => selectedApp.id === app.id)) {
        return current
      }

      return { ...current, apps: [...current.apps, app] }
    })
  }

  const moveApp = (index: number, offset: -1 | 1) => {
    setForm((current) => {
      const targetIndex = index + offset
      if (targetIndex < 0 || targetIndex >= current.apps.length) {
        return current
      }

      const apps = current.apps.slice()
      const app = apps[index]
      apps[index] = apps[targetIndex]
      apps[targetIndex] = app

      return { ...current, apps }
    })
  }

  const removeApp = (appId: string) => {
    setForm((current) => ({
      ...current,
      apps: current.apps.filter((app) => app.id !== appId),
    }))
  }

  const editSelection = (selection: ScheduledSelectionView) => {
    if (
      !canReplaceDirtyForm(isSelectionFormDirty(form, pristineForm), () =>
        window.confirm("Discard the current unsaved selection draft?"),
      )
    ) {
      return
    }

    const nextForm: SelectionFormState = {
      editingId: selection.id,
      themeId: selection.theme_id.toString(),
      slot: selection.slot,
      layout: selection.layout,
      startsAt: selection.starts_at,
      endsAt: selection.ends_at,
      enabled: selection.enabled,
      apps: selection.appDetails,
    }
    setForm(nextForm)
    setPristineForm(nextForm)
    setPickerResetGeneration((generation) => generation + 1)
    setFormError(null)
    setFormSuccess(null)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    setFormSuccess(null)

    if (!form.themeId) {
      setFormError("Choose a selection theme.")
      return
    }

    if (!form.startsAt || !form.endsAt) {
      setFormError("Choose a start and end date.")
      return
    }

    if (form.startsAt > form.endsAt) {
      setFormError("Start date must not be after end date.")
      return
    }

    if (form.apps.length === 0) {
      setFormError("Choose at least one app.")
      return
    }

    saveSelection.mutate({
      selectionId: form.editingId,
      appDetails: form.apps,
      body: {
        theme_id: Number(form.themeId),
        slot: form.slot,
        layout: form.layout,
        starts_at: form.startsAt,
        ends_at: form.endsAt,
        enabled: form.enabled,
        apps: form.apps.map((app, position) => ({
          app_id: app.id,
          position,
        })),
      },
    })
  }

  const isLoading =
    themesQuery.isPending ||
    selectionsQuery.isPending ||
    recommendationsQuery.isPending
  const isError =
    themesQuery.isError ||
    selectionsQuery.isError ||
    recommendationsQuery.isError

  return (
    <AdminLayoutClient
      condition={(info: GetUserinfoAuthUserinfoGet200) =>
        info.permissions.some(
          (permission) => permission === Permission["quality-moderation"],
        )
      }
    >
      <div className="max-w-11/12 mx-auto my-0 w-11/12 space-y-8 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <div>
          <h1 className="mt-8 text-4xl font-extrabold">Homepage Selections</h1>
          <p className="mt-2 max-w-3xl text-sm text-flathub-granite-gray dark:text-flathub-gainsborow">
            Schedule curated app groups for the homepage. Dates are UTC and each
            homepage slot can show one active selection at a time.
          </p>
        </div>

        {isLoading ? (
          <Spinner size="m" />
        ) : isError ? (
          <Card className="p-6">
            <h2 className="text-2xl font-bold">Could not load selections</h2>
            <p className="text-sm text-flathub-granite-gray dark:text-flathub-gainsborow">
              Refresh the page and try again.
            </p>
          </Card>
        ) : (
          <>
            <Card className="bg-flathub-white p-6 shadow-md dark:bg-flathub-arsenic">
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <h2 className="text-2xl font-bold">
                    {form.editingId ? "Edit Selection" : "Create Selection"}
                  </h2>
                  <p className="mt-1 text-sm text-flathub-granite-gray dark:text-flathub-gainsborow">
                    Pick an editorial theme, layout, homepage slot, UTC date
                    range, and the apps in their display order.
                  </p>
                </div>

                {formError && (
                  <div className="rounded-xl bg-flathub-status-red/20 p-3 text-sm text-flathub-status-red-dark dark:text-flathub-status-red">
                    {formError}
                  </div>
                )}

                {formSuccess && (
                  <div className="rounded-xl bg-flathub-status-green/20 p-3 text-sm text-flathub-status-green-dark dark:text-flathub-status-green">
                    {formSuccess}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="block text-sm font-semibold">
                    <span>Theme</span>
                    <Select
                      value={form.themeId || undefined}
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          themeId: value,
                        }))
                      }
                    >
                      <SelectTrigger
                        className={SELECT_TRIGGER_CLASS}
                        aria-label="Theme"
                      >
                        <SelectValue placeholder="Select a theme" />
                      </SelectTrigger>
                      <SelectContent className={SELECT_CONTENT_CLASS}>
                        {(themesQuery.data ?? []).map((theme) => {
                          const label = themeLabelsById.get(theme.id)

                          return (
                            <SelectItem
                              key={theme.id}
                              value={theme.id.toString()}
                              disabled={!theme.enabled}
                              className={SELECT_ITEM_CLASS}
                              description={
                                label?.subtitle ? (
                                  <span className="text-xs opacity-75">
                                    {label.subtitle}
                                  </span>
                                ) : undefined
                              }
                            >
                              {label?.title ?? theme.name}
                              {!theme.enabled ? " (disabled)" : ""}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="block text-sm font-semibold">
                    <span>Homepage slot</span>
                    <Select
                      value={form.slot}
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          slot: value as HomepageCuratedAppSelectionSlot,
                        }))
                      }
                    >
                      <SelectTrigger
                        className={SELECT_TRIGGER_CLASS}
                        aria-label="Homepage slot"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={SELECT_CONTENT_CLASS}>
                        {HOMEPAGE_CURATED_APP_SELECTION_SLOTS.map((slot) => (
                          <SelectItem
                            key={slot}
                            value={slot}
                            className={SELECT_ITEM_CLASS}
                          >
                            {SLOT_LABELS[slot]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="block text-sm font-semibold">
                    <span>Layout</span>
                    <Select
                      value={form.layout}
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          layout: value as HomepageCuratedAppSelectionLayout,
                        }))
                      }
                    >
                      <SelectTrigger
                        className={SELECT_TRIGGER_CLASS}
                        aria-label="Layout"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={SELECT_CONTENT_CLASS}>
                        {HOMEPAGE_CURATED_APP_SELECTION_LAYOUTS.map(
                          (layout) => (
                            <SelectItem
                              key={layout}
                              value={layout}
                              className={SELECT_ITEM_CLASS}
                            >
                              {LAYOUT_LABELS[layout]}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label
                      htmlFor="selection-starts-at"
                      className="block text-sm font-semibold"
                    >
                      Starts at UTC
                    </label>
                    <Input
                      id="selection-starts-at"
                      className="mt-2"
                      type="date"
                      value={form.startsAt}
                      required
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          startsAt: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="selection-ends-at"
                      className="block text-sm font-semibold"
                    >
                      Ends at UTC
                    </label>
                    <Input
                      id="selection-ends-at"
                      className="mt-2"
                      type="date"
                      value={form.endsAt}
                      required
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          endsAt: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm font-semibold">
                  <Checkbox
                    id="selection-enabled"
                    checked={form.enabled}
                    onCheckedChange={(checked) =>
                      setForm((current) => ({
                        ...current,
                        enabled: checked === true,
                      }))
                    }
                  />
                  <label htmlFor="selection-enabled">
                    Enabled on public homepage
                  </label>
                </div>

                <div className="space-y-4">
                  <AppPicker
                    apps={availableApps}
                    resetGeneration={pickerResetGeneration}
                    onAdd={addApp}
                  />

                  {availableApps.length === 0 && (
                    <p className="text-sm text-flathub-granite-gray dark:text-flathub-gainsborow">
                      No recommended apps are available for {recommendationDate}
                      . Run the backend update/quality moderation data refresh,
                      or pick a date with eligible recommendations.
                    </p>
                  )}

                  {form.apps.length === 0 ? (
                    <div className="rounded-xl bg-flathub-gainsborow/40 p-4 text-sm dark:bg-flathub-gainsborow/10">
                      No apps selected yet. Add at least one app before saving.
                    </div>
                  ) : (
                    <ol className="space-y-2">
                      {form.apps.map((app, index) => (
                        <li
                          key={app.id}
                          className="flex flex-col gap-3 rounded-xl bg-flathub-gainsborow/40 p-3 dark:bg-flathub-gainsborow/10 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="w-6 text-sm font-bold">
                              {index + 1}
                            </span>
                            <LogoImage
                              iconUrl={app.icon}
                              appName={app.name}
                              size={24}
                            />
                            <div className="min-w-0">
                              <div className="truncate font-semibold">
                                {app.name}
                              </div>
                              <div className="truncate text-sm text-flathub-granite-gray dark:text-flathub-gainsborow">
                                {app.subtitle}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={index === 0}
                              onClick={() => moveApp(index, -1)}
                            >
                              Move up
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={index === form.apps.length - 1}
                              onClick={() => moveApp(index, 1)}
                            >
                              Move down
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeApp(app.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={saveSelection.isPending}>
                    {saveSelection.isPending
                      ? "Saving..."
                      : form.editingId
                        ? "Save Selection"
                        : "Create Selection"}
                  </Button>
                  {form.editingId && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        resetForm()
                      }}
                    >
                      Cancel edit
                    </Button>
                  )}
                </div>
              </form>
            </Card>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold">Scheduled Selections</h2>
              {partitionedSelections.current.length === 0 ? (
                <Card className="p-6">
                  <p className="text-sm text-flathub-granite-gray dark:text-flathub-gainsborow">
                    {(selectionsQuery.data ?? []).length === 0
                      ? "No homepage selections have been scheduled yet."
                      : "No active or upcoming homepage selections."}
                  </p>
                </Card>
              ) : (
                <ScheduledSelectionCards
                  selections={partitionedSelections.current}
                  themesById={themesById}
                  themeLabelsById={themeLabelsById}
                  deleting={deleteSelection.isPending}
                  onEdit={editSelection}
                  onDelete={(selectionId) =>
                    deleteSelection.mutate(selectionId)
                  }
                />
              )}

              {partitionedSelections.past.length > 0 ? (
                <details className="rounded-xl border border-input bg-flathub-white dark:bg-flathub-arsenic">
                  <summary className="cursor-pointer px-6 py-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2">
                    Past selections ({partitionedSelections.past.length})
                  </summary>
                  <div className="border-t border-input p-4">
                    <ScheduledSelectionCards
                      selections={partitionedSelections.past}
                      themesById={themesById}
                      themeLabelsById={themeLabelsById}
                      deleting={deleteSelection.isPending}
                      onEdit={editSelection}
                      onDelete={(selectionId) =>
                        deleteSelection.mutate(selectionId)
                      }
                    />
                  </div>
                </details>
              ) : null}
            </section>
          </>
        )}
      </div>
    </AdminLayoutClient>
  )
}

function AppPicker({
  apps,
  resetGeneration,
  onAdd,
}: {
  apps: SelectableApp[]
  resetGeneration: number
  onAdd: (app: SelectableApp) => void
}) {
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    setQuery("")
  }, [resetGeneration])

  const matchingApps = apps.filter((app) =>
    matchesAppSearch(app, deferredQuery),
  )

  return (
    <div className="space-y-3">
      <label htmlFor="recommended-app-search" className="text-sm font-semibold">
        Add app from recommendation pool
      </label>
      <Input
        id="recommended-app-search"
        type="search"
        placeholder="Search by name, summary, app ID, or keyword"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div
        className="grid max-h-[32rem] grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3"
        aria-live="polite"
      >
        {matchingApps.map((app) => (
          <button
            key={app.id}
            type="button"
            className="flex min-h-24 items-start gap-4 rounded-xl border border-input bg-flathub-gainsborow/30 p-4 text-left transition-colors hover:bg-flathub-gainsborow/60 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-flathub-gainsborow/5 dark:hover:bg-flathub-gainsborow/10"
            onClick={() => onAdd(app)}
          >
            <LogoImage iconUrl={app.icon} appName={app.name} size={64} />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{app.name}</span>
              <span className="mt-1 line-clamp-2 block text-sm text-flathub-granite-gray dark:text-flathub-gainsborow">
                {app.subtitle}
              </span>
            </span>
          </button>
        ))}
      </div>
      {apps.length > 0 && matchingApps.length === 0 ? (
        <p className="text-sm text-flathub-granite-gray dark:text-flathub-gainsborow">
          No recommended apps match this search.
        </p>
      ) : null}
    </div>
  )
}

function ScheduledSelectionCards({
  selections,
  themesById,
  themeLabelsById,
  deleting,
  onEdit,
  onDelete,
}: {
  selections: ScheduledSelectionView[]
  themesById: Map<number, { name: string }>
  themeLabelsById: Map<number, ThemeLabel>
  deleting: boolean
  onEdit: (selection: ScheduledSelectionView) => void
  onDelete: (selectionId: number) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {selections.map((selection) => {
        const theme = themesById.get(selection.theme_id)
        const label = themeLabelsById.get(selection.theme_id)

        return (
          <Card
            key={selection.id}
            className="bg-flathub-white shadow-md dark:bg-flathub-arsenic"
          >
            <CardHeader>
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-xl font-bold">
                    {label?.title ?? theme?.name ?? selection.theme_key}
                  </h3>
                  {label?.subtitle ? (
                    <p className="mt-1 text-sm text-flathub-granite-gray dark:text-flathub-gainsborow">
                      {label.subtitle}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm text-flathub-granite-gray dark:text-flathub-gainsborow">
                    {SLOT_LABELS[selection.slot]} ·{" "}
                    {LAYOUT_LABELS[selection.layout]} · {selection.starts_at} to{" "}
                    {selection.ends_at}
                  </p>
                </div>
                <span className="w-fit rounded-full bg-flathub-gainsborow/60 px-3 py-1 text-xs font-semibold dark:bg-flathub-gainsborow/10">
                  {selection.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {selection.appDetails.map((app, index) => (
                  <li
                    key={app.id}
                    className="flex min-w-0 items-center gap-3 text-sm"
                  >
                    <span className="w-6 font-bold">{index + 1}</span>
                    <LogoImage
                      iconUrl={app.icon}
                      appName={app.name}
                      size={24}
                    />
                    <span className="truncate">{app.name}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
            <CardFooter className="flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onEdit(selection)}
              >
                Edit
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleting}
                onClick={() => {
                  if (
                    window.confirm("Delete this homepage selection schedule?")
                  ) {
                    onDelete(selection.id)
                  }
                }}
              >
                Delete
              </Button>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
