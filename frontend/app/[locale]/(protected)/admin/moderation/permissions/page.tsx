import { Metadata } from "next"
import PermissionReviewsClient from "./permission-reviews-client"

export const metadata: Metadata = {
  title: "Permission reviews",
  robots: { index: false },
}

export default function PermissionReviewsPage() {
  return <PermissionReviewsClient />
}
