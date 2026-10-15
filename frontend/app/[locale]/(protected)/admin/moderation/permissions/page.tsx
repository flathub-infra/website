import { Metadata } from "next"
import ModerationGuard from "src/components/moderation/ModerationGuard"
import PermissionReviewList from "src/components/moderation/PermissionReviewList"

export const metadata: Metadata = {
  title: "Permission reviews",
  robots: { index: false },
}

export default function PermissionReviewsPage() {
  return (
    <ModerationGuard>
      <PermissionReviewList />
    </ModerationGuard>
  )
}
