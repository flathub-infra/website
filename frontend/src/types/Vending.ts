export interface VendingStatus {
  can_take_payments: boolean
  needs_attention: boolean
  details_submitted: boolean
}

export interface VendingRedirect {
  target_url: string
}
