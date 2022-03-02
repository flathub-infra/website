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
