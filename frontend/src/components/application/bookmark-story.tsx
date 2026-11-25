import type { ComponentType } from "react"
import { http, HttpResponse } from "msw"
import { UserContext } from "src/context/user-info"

export const publicBookmarkCount = http.get("*/favorites/:appId/count", () =>
  HttpResponse.json({ favorites_count: 674 }),
)

export function withSignedOutUser(Story: ComponentType) {
  return (
    <UserContext value={{ loading: false, info: undefined }}>
      <Story />
    </UserContext>
  )
}
