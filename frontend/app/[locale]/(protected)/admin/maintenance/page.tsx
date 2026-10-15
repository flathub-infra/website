import type { Metadata } from "next"
import MaintenanceClient from "./maintenance-client"

export const metadata: Metadata = {
  title: "Maintenance Radar",
  robots: { index: false },
}

export default function MaintenancePage() {
  return <MaintenanceClient />
}
