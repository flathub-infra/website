import { APIResponseOk } from "./API"

export interface VendingStatus extends APIResponseOk {
  can_take_payments: boolean
  needs_attention: boolean
  details_submitted: boolean
}

export interface VendingRedirect extends APIResponseOk {
  target_url: string
}
