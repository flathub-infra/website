"use client"

import { useState } from "react"
import { useGetPermissionStatsStatsPermissionsGet } from "src/codegen/stats/stats"
import PermissionStatsDashboard from "./PermissionStatsDashboard"

export default function PermissionStats() {
  const [months, setMonths] = useState<6 | 12>(6)
  const query = useGetPermissionStatsStatsPermissionsGet(
    { months },
    { query: { staleTime: 15 * 60 * 1000 } },
  )
  return (
    <PermissionStatsDashboard
      window={query.data?.data}
      months={months}
      onMonthsChange={setMonths}
      isLoading={query.isPending}
      isError={query.isError}
      onRetry={() => {
        void query.refetch()
      }}
    />
  )
}
