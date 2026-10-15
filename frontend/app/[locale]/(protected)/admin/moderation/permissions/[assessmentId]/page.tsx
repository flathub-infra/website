import { Metadata } from "next"
import ModerationGuard from "src/components/moderation/ModerationGuard"
import PermissionReviewDetail from "src/components/moderation/PermissionReviewDetail"

export const metadata: Metadata = {
  title: "Permission review",
  robots: { index: false },
}

export default async function PermissionReviewPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>
}) {
  const { assessmentId } = await params
  return (
    <ModerationGuard>
      <PermissionReviewDetail assessmentId={parseInt(assessmentId)} />
    </ModerationGuard>
  )
}
