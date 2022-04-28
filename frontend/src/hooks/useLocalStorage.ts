import { useState } from "react"

/* Adapted from https://usehooks.com/useLocalStorage/, Unlicense */

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (arg: T | ((arg: T) => T)) => void] {
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return initialValue

    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (err) {
      console.log(err)
      return initialValue
    }
  })

  const setter = (newValue: T | ((arg: T) => T)) => {
    try {
      if (newValue instanceof Function) newValue = newValue(value)

      window.localStorage.setItem(key, JSON.stringify(newValue))
      setValue(newValue)
    } catch (err) {
      console.log(err)
    }
  }

  return [value, setter]
}
