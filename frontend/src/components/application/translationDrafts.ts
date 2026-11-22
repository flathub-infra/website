import { useReducer, useState } from "react"
import type { SharedTranslationUnit } from "src/codegen/model/sharedTranslationUnit"

type Field = SharedTranslationUnit
export type Draft = { text: string; version: string; source: string }
const pending = new Map<string, Map<string, Draft>>()

export function hasTranslationDrafts(key: string) {
  return pending.has(key)
}
export function discardTranslationDrafts(key: string | undefined) {
  if (key) {
    pending.delete(key)
  }
}

function identity(field: Field) {
  return JSON.stringify([field.id, field.field, field.context, field.source])
}

// Keep drafts in memory so Back can restore them without writing them to disk.
export function openTranslationDrafts(key?: string, changed = () => {}) {
  const local = new Map<string, Draft>()
  const current = () => (key && pending.get(key)) || local
  function commit(entries: Map<string, Draft>) {
    if (key && entries.size) {
      pending.set(key, entries)
    } else {
      discardTranslationDrafts(key)
    }
    changed()
  }
  function discard(field: Field | string) {
    const entries = current()
    entries.delete(typeof field === "string" ? field : identity(field))
    commit(entries)
  }
  return {
    get(field: Field) {
      return current().get(identity(field))
    },
    isEdited(field: Field) {
      const draft = current().get(identity(field))
      return draft !== undefined && draft.text.trim() !== field.translation
    },
    edit(
      field: Field,
      text: string,
      version = current().get(identity(field))?.version ?? field.version,
      keepOriginal = false,
    ) {
      if (text === field.translation && !keepOriginal) {
        discard(field)
      } else {
        const entries = key
          ? (pending.get(key) ?? new Map<string, Draft>())
          : local
        entries.set(identity(field), { source: field.source, text, version })
        commit(entries)
      }
    },
    unmatched(fields: Field[]) {
      const present = new Set(fields.map(identity))
      return [...current()].filter(([id]) => !present.has(id))
    },
    discard,
    acknowledgeSave(field: Field, submitted: Draft | undefined, saved?: Field) {
      const entries = current()
      const id = identity(field)
      const draft = entries.get(id)
      if (!submitted || !draft) {
        return
      }
      if (draft === submitted) {
        discard(field)
      } else if (
        saved &&
        identity(saved) === id &&
        draft.version === submitted.version
      ) {
        if (draft.text === saved.translation) {
          discard(field)
        } else {
          entries.set(id, { ...draft, version: saved.version })
          commit(entries)
        }
      }
    },
  }
}

export function useTranslationDrafts(key?: string) {
  const [, changed] = useReducer((revision: number) => revision + 1, 0)
  return useState(() => openTranslationDrafts(key, changed))[0]
}
