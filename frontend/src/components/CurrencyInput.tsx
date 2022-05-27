import { FormEvent, FunctionComponent, useCallback } from "react"

interface Props {
  value: string
  setValue: React.Dispatch<React.SetStateAction<string>>
  minimum?: number
  maximum?: number
}

/**
 * An input for currency in a form.
 *
 * This is expected to be used as a controlled component, the state of which is lifted to the parent component.
 */
const CurrencyInput: FunctionComponent<Props> = ({
  value,
  setValue,
  minimum = 0,
  maximum = Number.MAX_VALUE,
}) => {
  // Prevent entering fractional cents
  const handleChange = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      const valueString = event.currentTarget.value

      if (valueString.match(/^\d*(\.\d{0,2})?$/)) {
        setValue(valueString)
      }
    },
    [setValue],
  )

  // Always show cent value for consistency (removes ambiguity)
  const handleBlur = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      // Don't use valueAsNumber to prevent NaN
      const value = Number(event.currentTarget.value)

      setValue(Math.max(minimum, Math.min(maximum, value)).toFixed(2))
    },
    [minimum, maximum, setValue],
  )

  return (
    <div>
      <label className="absolute mt-2 ml-2 text-xl">$</label>
      <input
        type="text"
        inputMode="numeric"
        pattern="\d*(\.\d{0,2})?"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        className="rounded-xl border-none bg-bgColorPrimary p-2 pl-7 text-textPrimary outline-none"
      />
    </div>
  )
}

export default CurrencyInput
