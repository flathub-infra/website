import {
  MODERATION_APPS_URL,
  MODERATION_APP_URL,
  MODERATION_REVIEW_URL,
} from "src/env"
import { ModerationApp, ModerationApps } from "src/types/Moderation"

/**
 * Performs API request to retrieve list of apps for moderation
 * @returns array of apps
 */
export async function getModerationApps(
  limit: number = 100,
  offset: number = 0,
): Promise<ModerationApps> {
  let res: Response
  try {
    res = await fetch(
      MODERATION_APPS_URL +
        "?" +
        new URLSearchParams({
          limit: limit.toString(),
          offset: offset.toString(),
        }),
      { credentials: "include" },
    )
  } catch {
    throw "failed-to-load-refresh"
  }

  if (res.ok) {
    const data: ModerationApps = await res.json()
    return data
  } else {
    throw "failed-to-load-refresh"
  }
}

export async function getModerationApp(
  appId: string,
  includeOutdated: boolean = false,
  includeHandled: boolean = false,
  limit: number = 25,
  offset: number = 0,
): Promise<ModerationApp> {
  let res: Response
  try {
    const url =
      MODERATION_APP_URL(appId) +
      "?" +
      new URLSearchParams({
        include_outdated: includeOutdated.toString(),
        include_handled: includeHandled.toString(),
        limit: limit.toString(),
        offset: offset.toString(),
      })
    res = await fetch(url, { credentials: "include" })
  } catch {
    throw "failed-to-load-refresh"
  }

  if (res.ok) {
    return await res.json()
  } else {
    throw "failed-to-load-refresh"
  }
}

export async function submitReview(
  requestId: number,
  approve: boolean,
  comment?: string,
): Promise<void> {
  let res: Response
  try {
    res = await fetch(MODERATION_REVIEW_URL(requestId), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approve,
        comment,
      }),
    })
  } catch {
    throw "failed-to-load-refresh"
  }

  if (!res.ok) {
    throw "failed-to-load-refresh"
  }
}
