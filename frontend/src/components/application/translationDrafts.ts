import { useReducer, useState } from "react"
import type { SharedTranslationUnit } from "src/codegen/model/sharedTranslationUnit"

type Field = SharedTranslationUnit
type Draft = { text: string; version: string; source: string }
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
  const entries = new Map(key ? pending.get(key) : undefined)
  function commit() {
    if (key && entries.size) {
      pending.set(key, entries)
    } else {
      discardTranslationDrafts(key)
    }
    changed()
  }
  function discard(field: Field | string) {
    entries.delete(typeof field === "string" ? field : identity(field))
    commit()
  }
  return {
    get(field: Field) {
      return entries.get(identity(field))
    },
    isEdited(field: Field) {
      const draft = entries.get(identity(field))
      return draft !== undefined && draft.text.trim() !== field.translation
    },
    edit(
      field: Field,
      text: string,
      version = entries.get(identity(field))?.version ?? field.version,
    ) {
      if (text === field.translation) {
        discard(field)
      } else {
        entries.set(identity(field), { source: field.source, text, version })
        commit()
      }
    },
    unmatched(fields: Field[]) {
      const present = new Set(fields.map(identity))
      return [...entries].filter(([id]) => !present.has(id))
    },
    discard,
  }
}

export function useTranslationDrafts(key?: string) {
  const [, changed] = useReducer((revision: number) => revision + 1, 0)
  return useState(() => openTranslationDrafts(key, changed))[0]
}
