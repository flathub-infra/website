import { describe, expect, it, vi } from "vitest"
import {
  canReplaceDirtyForm,
  createFormResetState,
  createInitialForm,
  isSelectionFormDirty,
  matchesAppSearch,
  partitionAndSortSelections,
  resolveThemeLabel,
  type SelectableApp,
} from "./homepage-selections"

const app: SelectableApp = {
  id: "org.example.Writer",
  name: "Paperwork",
  subtitle: "Write without distractions",
  icon: "",
  keywords: ["Notes", "Markdown"],
}

describe("resolveThemeLabel", () => {
  const theme = {
    id: 1,
    key: "take-better-notes",
    name: "Backend theme name",
    enabled: true,
  }
  const translations: Record<string, string> = {
    "curated-app-selection-themes.take-better-notes.header":
      "Take Better Notes",
    "curated-app-selection-themes.take-better-notes.description":
      "Find your new favorite note taking tool",
  }

  it("resolves the translated title and subtitle from the current theme key", () => {
    const label = resolveThemeLabel(
      theme,
      (key) => key in translations,
      (key) => translations[key],
    )

    expect(label).toEqual({
      title: "Take Better Notes",
      subtitle: "Find your new favorite note taking tool",
    })
  })

  it("falls back to the backend name and omits a missing subtitle", () => {
    expect(resolveThemeLabel(theme, () => false, vi.fn())).toEqual({
      title: "Backend theme name",
      subtitle: undefined,
    })
  })
})

describe("matchesAppSearch", () => {
  it.each(["paper", "DISTRACTIONS", "org.example", "markdown"])(
    "matches %s across app metadata",
    (query) => expect(matchesAppSearch(app, query)).toBe(true),
  )

  it("rejects unrelated terms", () => {
    expect(matchesAppSearch(app, "spreadsheet")).toBe(false)
  })
})

describe("form snapshots", () => {
  it("detects field changes and selected app order changes", () => {
    const pristine = {
      ...createInitialForm("2026-08-07"),
      apps: [app, { ...app, id: "b" }],
    }

    expect(isSelectionFormDirty(pristine, pristine)).toBe(false)
    expect(isSelectionFormDirty({ ...pristine, enabled: true }, pristine)).toBe(
      true,
    )
    expect(
      isSelectionFormDirty({ ...pristine, layout: "carousel" }, pristine),
    ).toBe(true)
    expect(
      isSelectionFormDirty(
        { ...pristine, apps: pristine.apps.slice().reverse() },
        pristine,
      ),
    ).toBe(true)
  })

  it("preserves a dirty draft when replacement is declined", () => {
    const confirmDiscard = vi.fn(() => false)

    expect(canReplaceDirtyForm(true, confirmDiscard)).toBe(false)
    expect(confirmDiscard).toHaveBeenCalledOnce()
  })

  it("resets the form snapshot, messages, and picker state together", () => {
    const form = createInitialForm("2026-08-07")

    expect(createFormResetState("2026-08-07", 4, "Selection saved.")).toEqual({
      form,
      pristineForm: form,
      pickerResetGeneration: 5,
      formError: null,
      formSuccess: "Selection saved.",
    })
    expect(form).toEqual({
      themeId: "",
      slot: "after-top-apps",
      layout: "grid",
      startsAt: "2026-08-07",
      endsAt: "2026-08-14",
      enabled: false,
      apps: [],
    })
  })

  it("defaults the end date to seven UTC days later across month boundaries", () => {
    expect(createInitialForm("2026-12-28").endsAt).toBe("2027-01-04")
  })
})

describe("partitionAndSortSelections", () => {
  const selection = (
    id: number,
    startsAt: string,
    endsAt: string,
    slot: "after-hero" | "after-top-apps" | "after-first-category-block",
  ) => ({
    id,
    starts_at: startsAt,
    ends_at: endsAt,
    slot,
  })

  it("keeps schedules ending today current and sorts by start, slot, then id", () => {
    const result = partitionAndSortSelections(
      [
        selection(4, "2026-08-08", "2026-08-10", "after-hero"),
        selection(3, "2026-08-07", "2026-08-07", "after-top-apps"),
        selection(2, "2026-08-07", "2026-08-10", "after-hero"),
        selection(1, "2026-08-01", "2026-08-06", "after-hero"),
      ],
      "2026-08-07",
    )

    expect(result.current.map(({ id }) => id)).toEqual([2, 3, 4])
    expect(result.past.map(({ id }) => id)).toEqual([1])
  })
})
