/**
 * For best UX practice numeric values are input as text.
 *
 * Both the value during editing and the resolved number on blur need to be
 * state shared elsewhere in the form.
 */
export interface NumericInputValue {
  live: number
  settled: number
}
