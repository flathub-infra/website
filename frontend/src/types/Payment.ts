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

type TransactionKind = 'donation' | 'purchase'
type TransactionStatus = 'new' | 'pending' | 'retry' | 'success' | 'cancelled'
