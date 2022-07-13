import {
  DetailedHTMLProps,
  FormEvent,
  forwardRef,
  FunctionComponent,
  InputHTMLAttributes,
  useCallback,
} from "react"

type Props = {
  setValue: React.Dispatch<React.SetStateAction<number>>
} & DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>

/**
 * The control elements to see and alter the app vending share a component recieves.
 *
 * This is expected to be used as a controlled component, the state of which is lifted to the parent component.
 */
const AppShareSlider: FunctionComponent<Props> = forwardRef<
  HTMLInputElement,
  Props
>(({ value, setValue, ...sliderProps }, ref) => {
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
        ref={ref}
        {...sliderProps}
      ></input>
      <label>{value}%</label>
    </div>
  )
})

AppShareSlider.displayName = "AppShareSlider"

export default AppShareSlider
