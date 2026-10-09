import { isAxiosError } from "axios"

export function isReauthenticationRequired(error: unknown): boolean {
  return (
    isAxiosError(error) &&
    error.response?.status === 403 &&
    error.response?.data?.detail === "reauthentication_required"
  )
}

export async function runWithReauth<T>(
  action: () => Promise<T>,
  reauthenticate: () => Promise<boolean>,
): Promise<T | undefined> {
  try {
    return await action()
  } catch (error) {
    if (!isReauthenticationRequired(error)) throw error
  }

  if (!(await reauthenticate())) return undefined
  return action()
}
