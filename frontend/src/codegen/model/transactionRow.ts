/**
 * Generated by orval 🍺
 * Do not edit manually.
 * Flathub API
 * OpenAPI spec version: 0.1.0
 */
import type { TransactionRowKind } from "./transactionRowKind"

export interface TransactionRow {
  recipient: string
  amount: number
  currency: string
  kind: TransactionRowKind
}
