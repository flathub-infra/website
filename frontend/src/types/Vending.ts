import { APIResponseOk } from "./API"

export interface VendingStatus extends APIResponseOk {
  can_take_payments: boolean
  needs_attention: boolean
  details_submitted: boolean
}

export interface VendingRedirect extends APIResponseOk {
  target_url: string
}

export interface VendingPlatform {
  depends?: string
  aliases: string[]
  keep: number
}

export interface VendingConfig extends APIResponseOk {
  platforms: Record<string, VendingPlatform>
  fee_fixed_cost: number
  fee_cost_percent: number
  fee_prefer_percent: number
}

export type VendingShare = [string, number]

export interface VendingDescriptor extends APIResponseOk {
  currency: string
  components: VendingShare[]
  fee_fixed_cost: number
  fee_cost_percent: number
  fee_prefer_percent: number
}

/**
 * `appshare` is an integer representing percentage of payment going towards the app.
 * `recommended_donation` is ...
 * `minimum_payment` is an integer for the price of the app in cents.
 */
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
