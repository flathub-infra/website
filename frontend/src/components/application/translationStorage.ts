export function readPreference(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writePreference(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Preferences are optional when the browser blocks storage.
  }
}
