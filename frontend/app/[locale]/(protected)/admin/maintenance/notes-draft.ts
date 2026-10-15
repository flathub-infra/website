interface NotesDraft {
  value: string
  saved: string
  conflict: boolean
}

type NotesDraftAction =
  | { type: "edit"; value: string }
  | { type: "refresh"; saved: string }
  | { type: "saved"; submitted: string; saved: string }
  | { type: "discard"; saved: string }

export function createNotesDraft(saved: string): NotesDraft {
  return { value: saved, saved, conflict: false }
}

export function notesDraftReducer(
  draft: NotesDraft,
  action: NotesDraftAction,
): NotesDraft {
  switch (action.type) {
    case "edit":
      return {
        ...draft,
        value: action.value,
        conflict: draft.conflict && action.value !== draft.saved,
      }
    case "refresh": {
      const dirty = draft.value !== draft.saved
      return {
        value: dirty ? draft.value : action.saved,
        saved: action.saved,
        conflict:
          dirty &&
          draft.value !== action.saved &&
          (draft.conflict || action.saved !== draft.saved),
      }
    }
    case "saved":
      // Acknowledge only the submitted snapshot, never replace newer edits.
      return {
        value: draft.value === action.submitted ? action.saved : draft.value,
        saved: action.saved,
        conflict: false,
      }
    case "discard":
      return createNotesDraft(action.saved)
  }
}
