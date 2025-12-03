import {
  DetailedHTMLProps,
  FormEvent,
  FunctionComponent,
  InputHTMLAttributes,
  useCallback,
  useEffect,
  useState,
} from "react"
import { NumericInputValue } from "../../types/Input"
import { Input } from "@/components/ui/input"
import { DollarSign } from "lucide-react"

type Props = {
  inputValue: NumericInputValue
  setValue: React.Dispatch<React.SetStateAction<NumericInputValue>>
  maximum: number
} & DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>

/**
 * An input for currency in a form.
 *
 * The user input will be constrained to positive values with 2 decimal places.
 *
 * This is expected to be used as a controlled component, the state of which is lifted to the parent component.
 * The parent component must apply any further constraint or feedback desired (e.g. disable form submission).
 */
const CurrencyInput: FunctionComponent<Props> = ({
  ref,
  inputValue,
  setValue,
  maximum,
  ...inputProps
}: Props & {
  ref: React.RefObject<HTMLInputElement>
}) => {
  // String state used to allow temporary invalid numeric states (e.g. entering leading decimal)
  const [userInput, setUserInput] = useState(inputValue.live.toFixed(2))

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
    },
    [inputValue, setValue],
  )

  const handleBlur = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      const numeric = Number(event.currentTarget.value)

      // Treat lone decimal point as 0 value
      const settled = isNaN(numeric) ? 0 : numeric

      setValue({ ...inputValue, settled })
    },
    [inputValue, setValue],
  )

  return (
    <div className="max-w-full md:max-w-44 relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-md bg-flathub-gainsborow/50 dark:bg-flathub-granite-gray/30">
        <DollarSign className="size-4 text-flathub-sonic-silver dark:text-flathub-spanish-gray" />
      </div>
      <Input
        type="text"
        inputMode="numeric"
        pattern="\d*(\.\d{0,2})?"
        maxLength={maximum.toString().length}
        value={userInput}
        onChange={handleChange}
        onBlur={handleBlur}
        ref={ref}
        className="ps-12 h-12 text-lg font-medium"
        {...inputProps}
      />
    </div>
  )
}

CurrencyInput.displayName = "CurrencyInput"

export default CurrencyInput
