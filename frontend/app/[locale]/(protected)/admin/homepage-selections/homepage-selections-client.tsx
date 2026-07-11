"use client"

import axios from "axios"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FormEvent, useMemo, useState } from "react"
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
import { FlathubCombobox } from "src/components/Combobox"
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
  HOMEPAGE_CURATED_APP_SELECTION_SLOTS,
  type HomepageCuratedAppSelectionSlot,
} from "src/types/CuratedAppSelection"
import { getUtcDateString } from "src/utils/date"

const SLOT_LABELS: Record<HomepageCuratedAppSelectionSlot, string> = {
  "after-hero": "After hero",
  "after-top-apps": "After Top Apps",
  "after-first-category-block": "After first category block",
}

const FIELD_CLASS =
  "h-12 w-full rounded-xl border border-input bg-flathub-gainsborow px-3 text-sm shadow-xs dark:bg-stone-900"
const SELECT_TRIGGER_CLASS = `${FIELD_CLASS} mt-2 text-flathub-dark-gunmetal hover:bg-flathub-gainsborow data-[state=open]:bg-flathub-gainsborow dark:text-flathub-lotion dark:hover:bg-stone-900 dark:data-[state=open]:bg-stone-900 [&>svg]:text-flathub-granite-gray dark:[&>svg]:text-flathub-gainsborow`
const SELECT_CONTENT_CLASS =
  "z-50 border-input bg-flathub-white text-flathub-dark-gunmetal shadow-xl dark:bg-stone-900 dark:text-flathub-lotion"
const SELECT_ITEM_CLASS =
  "cursor-pointer text-flathub-dark-gunmetal hover:bg-flathub-celestial-blue hover:text-flathub-white focus:bg-flathub-celestial-blue focus:text-flathub-white data-[highlighted]:bg-flathub-celestial-blue data-[highlighted]:text-flathub-white dark:text-flathub-lotion"

interface SelectableApp {
  id: string
  name: string
  subtitle: string
  icon: string
}

interface SelectionFormState {
  editingId?: number
  themeId: string
  slot: HomepageCuratedAppSelectionSlot
  startsAt: string
  endsAt: string
  enabled: boolean
  apps: SelectableApp[]
}

type ScheduledSelectionView = Omit<ScheduledSelectionAdmin, "slot"> & {
  slot: HomepageCuratedAppSelectionSlot
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

function createInitialForm(): SelectionFormState {
  const today = todayString()

  return {
    themeId: "",
    slot: "after-hero",
    startsAt: today,
    endsAt: today,
    enabled: false,
    apps: [],
  }
}

function appFallback(appId: string): SelectableApp {
  return {
    id: appId,
    name: appId,
    subtitle: "Appstream data unavailable",
    icon: "",
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
  const user = useUserContext()
  const queryClient = useQueryClient()
  const canModerate = !!user.info?.permissions.some(
    (permission) => permission === Permission["quality-moderation"],
  )

  const recommendationDate = todayString()
  const [form, setForm] = useState<SelectionFormState>(createInitialForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

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

  const availableApps = useMemo(() => {
    const selectedAppIds = new Set(form.apps.map((app) => app.id))
    return (recommendationsQuery.data ?? []).filter(
      (app) => !selectedAppIds.has(app.id),
    )
  }, [form.apps, recommendationsQuery.data])

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
      setForm(createInitialForm())
      setFormError(null)
      setFormSuccess(
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
        setForm(createInitialForm())
      }
      setFormError(null)
      setFormSuccess("Selection deleted.")
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
    setForm({
      editingId: selection.id,
      themeId: selection.theme_id.toString(),
      slot: selection.slot,
      startsAt: selection.starts_at,
      endsAt: selection.ends_at,
      enabled: selection.enabled,
      apps: selection.appDetails,
    })
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
                    Pick an editorial theme, a homepage slot, a UTC date range,
                    and the apps in their display order.
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
                        {(themesQuery.data ?? []).map((theme) => (
                          <SelectItem
                            key={theme.id}
                            value={theme.id.toString()}
                            disabled={!theme.enabled}
                            className={SELECT_ITEM_CLASS}
                          >
                            {theme.name}
                            {!theme.enabled ? " (disabled)" : ""}
                          </SelectItem>
                        ))}
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
                  <FlathubCombobox
                    items={availableApps}
                    selectedItem={null}
                    disabled={availableApps.length === 0}
                    label="Add app from recommendation pool"
                    placeholder="Search recommended apps"
                    variant="form"
                    setSelectedItem={addApp}
                    renderItem={(active, selected, item) => (
                      <AppComboboxItem
                        active={active}
                        selected={selected}
                        item={item}
                      />
                    )}
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
                        setForm(createInitialForm())
                        setFormError(null)
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
              {(selectionsQuery.data ?? []).length === 0 ? (
                <Card className="p-6">
                  <p className="text-sm text-flathub-granite-gray dark:text-flathub-gainsborow">
                    No homepage selections have been scheduled yet.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {(selectionsQuery.data ?? []).map((selection) => {
                    const theme = themesById.get(selection.theme_id)

                    return (
                      <Card
                        key={selection.id}
                        className="bg-flathub-white shadow-md dark:bg-flathub-arsenic"
                      >
                        <CardHeader>
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div>
                              <h3 className="text-xl font-bold">
                                {theme?.name ?? selection.theme_key}
                              </h3>
                              <p className="text-sm text-flathub-granite-gray dark:text-flathub-gainsborow">
                                {SLOT_LABELS[selection.slot]} ·{" "}
                                {selection.starts_at} to {selection.ends_at}
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
                                <span className="w-6 font-bold">
                                  {index + 1}
                                </span>
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
                            onClick={() => editSelection(selection)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            disabled={deleteSelection.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Delete this homepage selection schedule?",
                                )
                              ) {
                                deleteSelection.mutate(selection.id)
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
              )}
            </section>
          </>
        )}
      </div>
    </AdminLayoutClient>
  )
}

function AppComboboxItem({
  active,
  selected,
  item,
}: {
  active: boolean
  selected: boolean
  item: SelectableApp
}) {
  return (
    <div className="flex cursor-pointer items-center gap-2">
      <LogoImage iconUrl={item.icon} appName={item.name} size={24} />
      <div className="min-w-0">
        <span className={active || selected ? "font-bold" : "font-semibold"}>
          {item.name}
        </span>
        <span className="block truncate text-sm opacity-70">
          {item.subtitle}
        </span>
      </div>
    </div>
  )
}
