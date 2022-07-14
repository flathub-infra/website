import { useTranslation } from "next-i18next"
import {
  DetailedHTMLProps,
  FormEvent,
  forwardRef,
  FunctionComponent,
  InputHTMLAttributes,
  useCallback,
  useEffect,
  useState,
} from "react"
import { NumericInputValue } from "../types/Input"
import { formatCurrency } from "../utils/localize"

type Props = {
  inputValue: NumericInputValue
  setValue: React.Dispatch<React.SetStateAction<NumericInputValue>>
  minimum?: number
  maximum?: number
} & DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>

/**
 * An input for currency in a form.
 *
 * The user input will be constrained to positive values with 2 decimal places.
 * The minimum and maximum are not enforced, but visual feedback is given if they are violated.
 *
 * This is expected to be used as a controlled component, the state of which is lifted to the parent component.
 * The parent component must apply any further constraint or feedback desired (e.g. disable form submission).
 */
const CurrencyInput: FunctionComponent<Props> = forwardRef<
  HTMLInputElement,
  Props
>(
  (
    {
      inputValue,
      setValue,
      minimum = 0,
      maximum = Number.MAX_SAFE_INTEGER,
      ...inputProps
    },
    ref,
  ) => {
    const { t, i18n } = useTranslation()

    // String state used to allow temporary invalid numeric states (e.g. entering leading decimal)
    const [userInput, setUserInput] = useState(inputValue.live.toFixed(2))

    const [error, setError] = useState("")

    // Whenever a new value is settled the input should reflect it
    // Using an effect enables this to be set externally too
    useEffect(() => {
      // Always show cent value for consistency (removes ambiguity)
      setUserInput(inputValue.settled.toFixed(2))
    }, [inputValue.settled])

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

        setValue({ ...inputValue, live })

        // Removing error feedback on changes helps user to correct their input
        if (error !== "") {
          if (live >= minimum && live <= maximum) {
            setError("")
          }
        }
      },
      [minimum, maximum, inputValue, error, setValue],
    )

    const handleBlur = useCallback(
      (event: FormEvent<HTMLInputElement>) => {
        const numeric = Number(event.currentTarget.value)

        // Treat lone decimal point as 0 value
        const settled = isNaN(numeric) ? 0 : numeric

        setValue({ ...inputValue, settled })

        // Showing error feedback on blur avoids user annoyance during input
        if (settled < minimum) {
          setError(
            t("value-at-least", {
              value: formatCurrency(minimum, i18n.language),
            }),
          )
        } else if (settled > maximum) {
          setError(
            t("value-at-most", {
              value: formatCurrency(maximum, i18n.language),
            }),
          )
        }
      },
      [minimum, maximum, inputValue, setValue, t, i18n.language],
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
          ref={ref}
          className={`rounded-xl border-none bg-bgColorPrimary p-2 pl-7 text-textPrimary ${
            error ? "outline outline-2 outline-colorDanger" : "outline-none"
          }`}
          {...inputProps}
        />
        {error && (
          <p role="alert" className="my-2 text-colorDanger">
            {error}
          </p>
        )}
      </div>
    )
  },
)

CurrencyInput.displayName = "CurrencyInput"

export default CurrencyInput
