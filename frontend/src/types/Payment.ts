import { APIResponseOk } from "./API"

// Corresponds to `/wallet/walletinfo`
export interface WalletInfo extends APIResponseOk {
  cards: PaymentCard[]
  account?: object
}

export interface PaymentCard {
  id: string
  brand: string
  country: string
  exp_month: number
  exp_year: number
  last4: string
}

// Corresponds to objects from `/wallet/transactions`
type TransactionKind = "donation" | "purchase"
type TransactionStatus = "new" | "pending" | "retry" | "success" | "cancelled"

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
  card?: PaymentCard
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
