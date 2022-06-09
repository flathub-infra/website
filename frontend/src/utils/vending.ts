import { Appstream } from "../types/Appstream"
import { VendingConfig, VendingShare } from "../types/Vending"

/**
 * Finds the fee Flathub will take to cover this transaction.
 *
 * This function should maintain parity with the backend equivalent in app/vending/prices.py
 * @param total price being considered in integral form of currency
 * @param vendingConfig
 */
function flathubFee(total: number, vendingConfig: VendingConfig): number {
  const flatRate = Math.floor((total * vendingConfig.fee_prefer_percent) / 100)

  const variableRate =
    vendingConfig.fee_fixed_cost +
    Math.floor((total * vendingConfig.fee_cost_percent) / 100)

  return Math.round(Math.max(flatRate, variableRate))
}

/**
 * Find the percentage shares for the platform(s) for the given app.
 * Used to give a client side preview of the breakdown to developers without
 * generating excess network traffic.
 *
 * This function should maintain parity with the backend equivalent in app/vending/prices.py
 * @returns Percentage splits shared between app and its dependencies
 */
export function computeShares(
  app: Appstream,
  appShare: number,
  vendingConfig: VendingConfig,
): VendingShare[] {
  let remaining = 100 - appShare

  const shares: VendingShare[] = [[app.id, appShare]]

  let platform = app.bundle.runtime

  while (remaining > 0 && platform) {
    if (platform.includes("/")) {
      ;[platform] = platform.split("/", 1)
    }

    const platformConfig = vendingConfig.platforms[platform]
    const share = Math.floor((remaining * platformConfig.keep) / 100)

    if (share > 0) {
      shares.push([platform, share])
    }

    remaining -= share
    platform = platformConfig.depends
  }

  if (remaining != 0) {
    shares[0] = [app.id, appShare + remaining]
  }

  return shares
}

/**
 * Compute the shares that the app, flathub, and any platform(s) take from
 * the payment.
 * Used to give a client side preview of the breakdown to developers without
 * generating excess network traffic.
 *
 * This function should maintain parity with the backend equivalent in app/vending/prices.py
 * @param total price being considered in integral form of currency
 * @param shares percentage shares split between app and dependencies
 * @param vendingConfig global vending configuration containing platform and fee information
 * @returns Price breakdown shared between app, its dependencies and Flathub
 */
export function computeAppShares(
  total: number,
  shares: VendingShare[],
  vendingConfig: VendingConfig,
): VendingShare[] {
  // Avoid modifying original shares array
  const sharesCopy = [...shares]

  const splits: VendingShare[] = []
  const fhFee = flathubFee(total, vendingConfig)

  let remaining = total - fhFee

  // Preserve total to apply percentages
  const toSplit = remaining

  while (remaining > 0 && sharesCopy.length > 0) {
    const [appId, share] = sharesCopy.shift()
    const split = Math.round((toSplit * share) / 100)
    splits.push([appId, split])
    remaining -= split
  }

  // Add leftovers to application fee
  if (remaining > 0) {
    splits[0] = [splits[0][0], splits[0][1] + remaining]
  }

  splits.push(["org.flathub.Flathub", fhFee])

  return splits
}
