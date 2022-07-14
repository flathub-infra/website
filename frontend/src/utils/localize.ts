import { getIntlLocale } from "../localize"

export function formatCurrency(
  value: number,
  language: string = "en_US",
  currency: string = "USD",
): string {
  const formatter = new Intl.NumberFormat(getIntlLocale(language).toString(), {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
  })

  return formatter.format(value)
}
