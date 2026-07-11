import { UTCDate } from "@date-fns/utc/date"

export function getUtcDateString(date = new UTCDate()): string {
  return date.toISOString().slice(0, 10)
}
