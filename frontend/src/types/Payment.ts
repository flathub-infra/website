import { CardInfo } from "src/codegen"
import { APIResponseOk } from "./API"

// Corresponds to objects from `/wallet/transactions`
type TransactionKind = "donation" | "purchase"
export type TransactionStatus =
  | "new"
  | "pending"
  | "retry"
  | "success"
  | "cancelled"

export interface Transaction {
  id: string
  value: number
  currency: string
  kind: TransactionKind
  status: TransactionStatus
  reason: string
  created: number
  updated: number
}

export interface TransactionDetailed {
  summary: Transaction
  card?: CardInfo
  details: Payout[]
  receipt?: string
}

export interface Payout {
  recipient: string
  amount: number
  currency: string
  kind: TransactionKind
}

export interface NewTransaction extends APIResponseOk {
  id: string
}
