import { MODERATION_REVIEW_URL } from "src/env"

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
