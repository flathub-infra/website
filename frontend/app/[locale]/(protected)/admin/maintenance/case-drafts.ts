import {
  createNotesDraft,
  notesDraftReducer,
  type NotesDraft,
  type NotesDraftAction,
} from "./notes-draft"

export interface CaseDraft {
  notes: NotesDraft
  reason: string
  days: string
}

export type CaseDraftAction =
  | { type: "notes"; action: NotesDraftAction }
  | { type: "reason"; value: string }
  | { type: "days"; value: string }
  | { type: "snoozed" }

export interface CaseDraftsAction {
  appId: string
  savedNotes: string
  action: CaseDraftAction
}

export function createCaseDraft(savedNotes: string): CaseDraft {
  return { notes: createNotesDraft(savedNotes), reason: "", days: "30" }
}

// Owned by the page, not the dialog: closing a case must not discard its work.
export function caseDraftsReducer(
  drafts: Record<string, CaseDraft>,
  { appId, savedNotes, action }: CaseDraftsAction,
): Record<string, CaseDraft> {
  const current = drafts[appId] ?? createCaseDraft(savedNotes)
  let next: CaseDraft
  switch (action.type) {
    case "notes":
      next = {
        ...current,
        notes: notesDraftReducer(current.notes, action.action),
      }
      break
    case "reason":
      next = { ...current, reason: action.value }
      break
    case "days":
      next = { ...current, days: action.value }
      break
    case "snoozed":
      next = { ...current, reason: "", days: "30" }
      break
  }
  return { ...drafts, [appId]: next }
}

export function hasUnsavedCaseDraft(draft: CaseDraft): boolean {
  return draft.notes.value !== draft.notes.saved || draft.reason.trim() !== ""
}
