import { PaymentCardInfo } from "src/codegen"

// Corresponds to objects from `/wallet/transactions`
type TransactionKind = "donation" | "purchase"
export type TransactionStatus =
  | "new"
  | "pending"
  | "retry"
  | "success"
  | "cancelled"

interface Transaction {
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
  card?: PaymentCardInfo
  details: Payout[]
  receipt?: string
}

export interface Payout {
  recipient: string
  amount: number
  currency: string
  kind: TransactionKind
}
