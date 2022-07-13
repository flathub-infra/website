import { Switch } from "@headlessui/react"
import { FunctionComponent, useCallback } from "react"

interface Props {
  enabled: boolean
  setEnabled: React.Dispatch<React.SetStateAction<boolean>>
}

/**
 * A controlled component toggle for consistent look and feel.
 */
const Toggle: FunctionComponent<Props> = ({ enabled, setEnabled }) => {
  const toggle = useCallback(() => setEnabled(!enabled), [enabled, setEnabled])

  return (
    <Switch
      checked={enabled}
      onChange={toggle}
      className={`${
        enabled ? "bg-colorPrimary" : "bg-gray-200"
      } relative inline-flex h-6 w-11 items-center rounded-full`}
    >
      <span
        className={`${
          enabled ? "translate-x-6" : "translate-x-1"
        } inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out`}
      />
    </Switch>
  )
}

export default Toggle
