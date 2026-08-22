import {
  HOMEPAGE_CURATED_APP_SELECTION_LAYOUTS,
  HOMEPAGE_CURATED_APP_SELECTION_SLOTS,
  type HomepageCuratedAppSelectionLayout,
  type HomepageCuratedAppSelectionSlot,
} from "../../../../../src/types/CuratedAppSelection"

interface SelectionThemeLabelSource {
  key: string
  name: string
}

export interface SelectableApp {
  id: string
  name: string
  subtitle: string
  icon: string
  keywords: string[]
}

export interface SelectionFormState {
  editingId?: number
  themeId: string
  slot: HomepageCuratedAppSelectionSlot
  layout: HomepageCuratedAppSelectionLayout
  startsAt: string
  endsAt: string
  enabled: boolean
  apps: SelectableApp[]
}

interface SortableSelection {
  id: number
  slot: HomepageCuratedAppSelectionSlot
  starts_at: string
  ends_at: string
}

export interface ThemeLabel {
  title: string
  subtitle?: string
}

export interface FormResetState {
  form: SelectionFormState
  pristineForm: SelectionFormState
  pickerResetGeneration: number
  formError: null
  formSuccess: string | null
}

export function createInitialForm(today: string): SelectionFormState {
  const endDate = new Date(`${today}T00:00:00Z`)
  endDate.setUTCDate(endDate.getUTCDate() + 7)

  return {
    themeId: "",
    slot: "after-top-apps",
    layout: HOMEPAGE_CURATED_APP_SELECTION_LAYOUTS[0],
    startsAt: today,
    endsAt: endDate.toISOString().slice(0, 10),
    enabled: false,
    apps: [],
  }
}

export function createFormResetState(
  today: string,
  currentPickerGeneration: number,
  successMessage: string | null = null,
): FormResetState {
  const form = createInitialForm(today)

  return {
    form,
    pristineForm: form,
    pickerResetGeneration: currentPickerGeneration + 1,
    formError: null,
    formSuccess: successMessage,
  }
}

export function isSelectionFormDirty(
  form: SelectionFormState,
  pristine: SelectionFormState,
) {
  return (
    form.editingId !== pristine.editingId ||
    form.themeId !== pristine.themeId ||
    form.slot !== pristine.slot ||
    form.layout !== pristine.layout ||
    form.startsAt !== pristine.startsAt ||
    form.endsAt !== pristine.endsAt ||
    form.enabled !== pristine.enabled ||
    form.apps.length !== pristine.apps.length ||
    form.apps.some((app, index) => app.id !== pristine.apps[index]?.id)
  )
}

export function canReplaceDirtyForm(
  isDirty: boolean,
  confirmDiscard: () => boolean,
) {
  return !isDirty || confirmDiscard()
}

export function matchesAppSearch(app: SelectableApp, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) {
    return true
  }

  return [app.name, app.subtitle, app.id, ...app.keywords].some((value) =>
    value.toLocaleLowerCase().includes(normalizedQuery),
  )
}

export function resolveThemeLabel(
  theme: SelectionThemeLabelSource,
  hasTranslation: (key: string) => boolean,
  translate: (key: string) => string,
): ThemeLabel {
  const titleKey = `curated-app-selection-themes.${theme.key}.header`
  const subtitleKey = `curated-app-selection-themes.${theme.key}.description`

  return {
    title: hasTranslation(titleKey) ? translate(titleKey) : theme.name,
    subtitle: hasTranslation(subtitleKey) ? translate(subtitleKey) : undefined,
  }
}

export function partitionAndSortSelections<T extends SortableSelection>(
  selections: T[],
  today: string,
) {
  const slotOrder = new Map(
    HOMEPAGE_CURATED_APP_SELECTION_SLOTS.map((slot, index) => [slot, index]),
  )
  const compare = (a: T, b: T) =>
    a.starts_at.localeCompare(b.starts_at) ||
    (slotOrder.get(a.slot) ?? Number.MAX_SAFE_INTEGER) -
      (slotOrder.get(b.slot) ?? Number.MAX_SAFE_INTEGER) ||
    a.id - b.id

  return {
    current: selections
      .filter((selection) => selection.ends_at >= today)
      .sort(compare),
    past: selections
      .filter((selection) => selection.ends_at < today)
      .sort(compare),
  }
}
