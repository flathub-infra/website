import { APIResponseOk } from "./API"

export interface VendingStatus extends APIResponseOk {
  can_take_payments: boolean
  needs_attention: boolean
  details_submitted: boolean
}

export interface VendingRedirect extends APIResponseOk {
  target_url: string
}

type VendingShare = [string, number]

export interface VendingDescriptor extends APIResponseOk {
  currency: string
  components: VendingShare[]
  fee_fixed_cost: number
  fee_cost_percent: number
  fee_prefer_percent: number
}

export interface VendingSetup {
  currency: string
  appshare: number
  recommended_donation: number
  minimum_payment: number
}

export interface VendingSplit extends APIResponseOk {
  currency: string
  splits: VendingShare[]
}

export interface VendingOutput extends APIResponseOk {
  transaction: string
}

export interface ProposedPayment {
  currency: string
  amount: number
}
