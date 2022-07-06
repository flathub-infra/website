/**
 * For best UX practice numeric values are input as text.
 *
 * Both the value during editing and the resolved number on blur need to be
 * state shared elsewhere in the form for constraint and feedback.
 */
export interface NumericInputValue {
  live: number
  settled: number
}
