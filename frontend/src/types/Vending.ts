import { APIResponseOk } from "./API"

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

export interface VendingSplit extends APIResponseOk {
  currency: string
  splits: VendingShare[]
}

export interface VendingToken {
  id: string
  state: "unredeemed" | "redeemed" | "cancelled"
  name: string
  token?: string
  created: string
  changed: string
}

export interface VendingTokenList extends APIResponseOk {
  total: number
  tokens: VendingToken[]
}
