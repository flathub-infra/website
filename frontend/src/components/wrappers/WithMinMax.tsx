import { useTranslation } from "next-i18next"
import { FunctionComponent, useCallback } from "react"
import { NumericInputValue } from "../../types/Input"
import { formatCurrency } from "../../utils/localize"
import WithFeedback from "./WithFeedback"

interface Props {
  value: NumericInputValue
  minimum?: number
  maximum?: number
}

/**
A wrapper component to conditionally render a feedback error message below
the child components when a numeric currency input exceeds a minimum or maximum.

The intended use case is for form inputs.
*/
const WithMinMax: FunctionComponent<Props> = ({
  value,
  minimum,
  maximum,
  children,
}) => {
  const { t, i18n } = useTranslation()

  const exceedsMax = useCallback(
    () => maximum && value.settled > maximum,
    [maximum, value.settled],
  )
  const exceedsMin = useCallback(
    () => minimum && value.settled < minimum,
    [minimum, value.settled],
  )

  return (
    <WithFeedback
      condition={exceedsMin}
      error={t("value-at-least", {
        value: formatCurrency(minimum, i18n.language),
      })}
    >
      <WithFeedback
        condition={exceedsMax}
        error={t("value-at-most", {
          value: formatCurrency(maximum, i18n.language),
        })}
      >
        {children}
      </WithFeedback>
    </WithFeedback>
  )
}

export default WithMinMax
