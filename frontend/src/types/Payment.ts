// Corresponds to `/wallet/walletinfo`
export interface WalletInfo {
  status: string,
  cards: PaymentCard[],
  account?: object,
}

export interface PaymentCard {
  id: string,
  brand: string,
  country: string,
  exp_month: number,
  exp_year: number,
  last4: string,
}

// Corresponds to objects from `/wallet/transactions`
export interface Transaction {
  id: string,
  value: number,
  currency: string,
  kind: TransactionKind,
  status: TransactionStatus,
  reason: string,
  created: number,
  updated: number
}

export interface TransactionDetailed {
  summary: Transaction,
  card?: PaymentCard,
  details: Payout[],
  receipt?: string
}

export interface Payout {
  recipient: string,
  amount: number,
  currency: string,
  kind: TransactionKind,
}

type TransactionKind = 'donation' | 'purchase'
type TransactionStatus = 'new' | 'pending' | 'retry' | 'success' | 'cancelled'
