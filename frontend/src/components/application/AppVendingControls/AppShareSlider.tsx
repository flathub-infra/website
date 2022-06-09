import { FormEvent, FunctionComponent, useCallback } from "react"

interface Props {
  value: number
  setValue: React.Dispatch<React.SetStateAction<number>>
}

/**
 * The control elements to see and alter the app vending share a component recieves.
 *
 * This is expected to be used as a controlled component, the state of which is lifted to the parent component.
 */
const AppShareSlider: FunctionComponent<Props> = ({ value, setValue }) => {
  const handleChange = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      const value = event.currentTarget.valueAsNumber
      setValue(value)
    },
    [setValue],
  )

  return (
    <div>
      <input
        type="range"
        min="10"
        max="100"
        value={value}
        onChange={handleChange}
        className="block"
      ></input>
      <label>{value}%</label>
    </div>
  )
}

export default AppShareSlider
