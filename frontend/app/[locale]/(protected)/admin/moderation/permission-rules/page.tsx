import { Metadata } from "next"
import PermissionRulesClient from "./permission-rules-client"

export const metadata: Metadata = {
  title: "Permission rules",
  robots: { index: false },
}

export default function PermissionRulesPage() {
  return <PermissionRulesClient />
}
