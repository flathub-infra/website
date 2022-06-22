import { useTranslation } from "next-i18next"
import {
  FormEvent,
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from "react"
import { NumericInputValue } from "../types/Input"

interface Props {
  value: NumericInputValue
  setValue: React.Dispatch<React.SetStateAction<NumericInputValue>>
  minimum?: number
  maximum?: number
}

/**
 * An input for currency in a form.
 *
 * The user input will be constrained to positive values with 2 decimal places.
 * The minimum and maximum are not enforced, but visual feedback is given if they are violated.
 *
 * This is expected to be used as a controlled component, the state of which is lifted to the parent component.
 * The parent component must apply any further constraint or feedback desired (e.g. disable form submission).
 */
const CurrencyInput: FunctionComponent<Props> = ({
  value,
  setValue,
  minimum = 0,
  maximum = Number.MAX_VALUE,
}) => {
  const { t } = useTranslation()

  // String state used to allow temporary invalid numeric states (e.g. entering leading decimal)
  const [userInput, setUserInput] = useState(value.live.toFixed(2))

  const [minError, setMinError] = useState(false)
  const [maxError, setMaxError] = useState(false)

  // Whenever a new value is settled the input should reflect it
  // Using an effect enables this to be set externally too
  useEffect(() => {
    // Always show cent value for consistency (removes ambiguity)
    setUserInput(value.settled.toFixed(2))
  }, [value.settled])

  const handleChange = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      // Prevent entering negatives or fractional cents
      if (event.currentTarget.validity.patternMismatch) return

      // Don't enforce futher validation on users input
      const text = event.currentTarget.value
      setUserInput(text)

      // Treat lone decimal point as 0 value
      const numeric = Number(text)
      const live = isNaN(numeric) ? 0 : numeric

      setValue({ ...value, live })

      // Removing error feedback on changes helps user to correct their input
      if (minError) {
        setMinError(live < minimum)
      }
      if (maxError) {
        setMaxError(live > maximum)
      }
    },
    [minimum, maximum, value, minError, maxError, setValue],
  )

  const handleBlur = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      const numeric = Number(event.currentTarget.value)

      // Treat lone decimal point as 0 value
      const settled = isNaN(numeric) ? 0 : numeric

      setValue({ ...value, settled })

      // Showing error feedback on blur avoids user annoyance during input
      setMinError(settled < minimum)
      setMaxError(settled > maximum)
    },
    [minimum, maximum, value, setValue],
  )

  return (
    <div>
      <label className="absolute mt-2 ml-2 text-xl">$</label>
      <input
        type="text"
        inputMode="numeric"
        pattern="\d*(\.\d{0,2})?"
        value={userInput}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`rounded-xl border-none bg-bgColorPrimary p-2 pl-7 text-textPrimary ${
          minError || maxError
            ? "outline outline-2 outline-colorDanger"
            : "outline-none"
        }`}
      />
      {(minError || maxError) && (
        <p role="alert" className="my-2 text-colorDanger">
          {t(minError ? "value-at-least" : "value-at-most", {
            value: `$${minError ? minimum : maximum}`,
          })}
        </p>
      )}
    </div>
  )
}

export default CurrencyInput
