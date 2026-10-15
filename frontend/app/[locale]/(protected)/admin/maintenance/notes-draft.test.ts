import { describe, expect, it } from "vitest"
import { createNotesDraft, notesDraftReducer } from "./notes-draft"

describe("maintenance notes draft", () => {
  it("preserves edits made after a delayed save was submitted", async () => {
    let draft = createNotesDraft("Saved notes")
    draft = notesDraftReducer(draft, { type: "edit", value: "Submitted notes" })
    const submitted = draft.value
    let completeSave: (saved: string) => void
    const response = new Promise<string>((resolve) => {
      completeSave = resolve
    })
    const saved = response.then((notes) => {
      draft = notesDraftReducer(draft, {
        type: "saved",
        submitted,
        saved: notes,
      })
    })
    draft = notesDraftReducer(draft, {
      type: "edit",
      value: "Newer unsaved draft",
    })
    completeSave!(submitted)
    await saved
    draft = notesDraftReducer(draft, { type: "refresh", saved: submitted })
    expect(draft.value).toBe("Newer unsaved draft")
    expect(draft.saved).toBe(submitted)
  })

  it("preserves a conflicting draft while refreshing the shared version", () => {
    let draft = createNotesDraft("Original notes")
    draft = notesDraftReducer(draft, {
      type: "edit",
      value: "My investigation",
    })
    draft = notesDraftReducer(draft, {
      type: "refresh",
      saved: "Another moderator's notes",
    })
    expect(draft.value).toBe("My investigation")
    expect(draft.saved).toBe("Another moderator's notes")
    expect(draft.conflict).toBe(true)
    // Repeated refreshes must not silently resolve or replace the draft.
    expect(
      notesDraftReducer(draft, { type: "refresh", saved: draft.saved }),
    ).toEqual(draft)
  })

  it("updates untouched drafts when shared notes change", () => {
    expect(
      notesDraftReducer(createNotesDraft("Old"), {
        type: "refresh",
        saved: "New",
      }),
    ).toEqual(createNotesDraft("New"))
  })

  it("acknowledges a successful save without leaving the draft dirty", () => {
    const draft = notesDraftReducer(createNotesDraft("Old"), {
      type: "edit",
      value: "New",
    })
    expect(
      notesDraftReducer(draft, {
        type: "saved",
        submitted: "New",
        saved: "New",
      }),
    ).toEqual(createNotesDraft("New"))
  })

  it("discards local work only through an explicit choice", () => {
    const draft = { value: "Local", saved: "Remote", conflict: true }
    expect(
      notesDraftReducer(draft, { type: "discard", saved: "Remote" }),
    ).toEqual(createNotesDraft("Remote"))
  })
})
