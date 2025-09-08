import { useLocale, useTranslations } from "next-intl"
import { FunctionComponent, useCallback } from "react"
import { NumericInputValue } from "../../types/Input"
import { formatCurrency } from "../../utils/localize"
import InlineError from "../InlineError"
import { getIntlLocale } from "src/localize"
import { useRouter } from "src/i18n/navigation"

interface Props {
  value: NumericInputValue
  minimum?: number
  maximum?: number
}

/**
Conditionally renders errors if an associated currency input falls outside of some maximum or minimum limits.
*/
const MinMaxError: FunctionComponent<Props> = ({ value, minimum, maximum }) => {
  const t = useTranslations()
  const router = useRouter()
  const locale = useLocale()
  const i18n = getIntlLocale(locale)

  // Conditions such that errors appear on blur and hide on change
  const exceedsMax = useCallback(
    () => maximum && value.settled > maximum && value.live > maximum,
    [maximum, value],
  )
  const exceedsMin = useCallback(
    () => minimum && value.settled < minimum && value.live < minimum,
    [minimum, value],
  )

  return (
    <>
      <InlineError
        shown={exceedsMin()}
        error={t("value-at-least", {
          value: formatCurrency(minimum, i18n.language),
        })}
      />
      <InlineError
        shown={exceedsMax()}
        error={t("value-at-most", {
          value: formatCurrency(maximum, i18n.language),
        })}
      />
    </>
  )
}

export default MinMaxError
