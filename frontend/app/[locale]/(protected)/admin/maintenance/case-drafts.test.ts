import { describe, expect, it } from "vitest"
import {
  caseDraftsReducer,
  createCaseDraft,
  hasUnsavedCaseDraft,
  type CaseDraft,
  type CaseDraftAction,
} from "./case-drafts"

function update(
  drafts: Record<string, CaseDraft>,
  appId: string,
  action: CaseDraftAction,
  savedNotes = "Saved notes",
) {
  return caseDraftsReducer(drafts, { appId, savedNotes, action })
}

describe("page-owned maintenance drafts", () => {
  it("keeps notes, reasons, and durations separate for each app", () => {
    let drafts = update({}, "app.a", {
      type: "notes",
      action: { type: "edit", value: "My investigation" },
    })
    drafts = update(drafts, "app.a", { type: "reason", value: "Waiting" })
    drafts = update(drafts, "app.a", { type: "days", value: "7" })
    drafts = update(drafts, "app.b", {
      type: "notes",
      action: { type: "edit", value: "Other investigation" },
    })
    expect(drafts["app.a"]).toEqual({
      notes: {
        value: "My investigation",
        saved: "Saved notes",
        conflict: false,
      },
      reason: "Waiting",
      days: "7",
    })
    expect(drafts["app.b"].notes.value).toBe("Other investigation")
  })

  it("detects shared-note conflicts when a case is reopened", () => {
    let drafts = update({}, "app.a", {
      type: "notes",
      action: { type: "edit", value: "Local work" },
    })
    drafts = update(drafts, "app.a", {
      type: "notes",
      action: { type: "refresh", saved: "Another moderator's work" },
    })
    expect(drafts["app.a"].notes).toEqual({
      value: "Local work",
      saved: "Another moderator's work",
      conflict: true,
    })
  })

  it("acknowledges a save even after the dialog has closed", () => {
    let drafts = update({}, "app.a", {
      type: "notes",
      action: { type: "edit", value: "Submitted work" },
    })
    drafts = update(drafts, "app.a", {
      type: "notes",
      action: {
        type: "saved",
        submitted: "Submitted work",
        saved: "Submitted work",
      },
    })
    expect(hasUnsavedCaseDraft(drafts["app.a"])).toBe(false)
  })

  it("clears snooze inputs only after a successful snooze", () => {
    let drafts = update({}, "app.a", { type: "reason", value: "Waiting" })
    drafts = update(drafts, "app.a", { type: "days", value: "7" })
    expect(hasUnsavedCaseDraft(drafts["app.a"])).toBe(true)
    drafts = update(drafts, "app.a", { type: "snoozed" })
    expect(drafts["app.a"]).toEqual(createCaseDraft("Saved notes"))
    expect(hasUnsavedCaseDraft(drafts["app.a"])).toBe(false)
  })

  it("does not treat untouched notes or whitespace-only reasons as unsaved work", () => {
    expect(hasUnsavedCaseDraft(createCaseDraft("Saved notes"))).toBe(false)
    expect(
      hasUnsavedCaseDraft({ ...createCaseDraft("Saved notes"), reason: "  " }),
    ).toBe(false)
  })
})
