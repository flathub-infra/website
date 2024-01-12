import { APIResponseOk } from "./API"

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
