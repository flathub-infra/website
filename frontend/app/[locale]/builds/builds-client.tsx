"use client"

import { BuildDashboard } from "../../../@/components/build/build-dashboard"
import { PipelineRepoWithAll } from "../../../@/components/build/build-repo-filter"
import { PipelineStatusWithAll } from "../../../@/components/build/build-status-filter"
import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Spinner from "../../../src/components/Spinner"

function BuildsContent() {
  const searchParams = useSearchParams()
  const appId = searchParams.get("appId") ?? undefined
  const [statusFilter, setStatusFilter] = useState<PipelineStatusWithAll>("all")
  const [repoFilter, setRepoFilter] = useState<PipelineRepoWithAll>("all")

  return (
    <div className="max-w-11/12 mx-auto my-0 mt-4 w-11/12 space-y-10 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <h1 className="mt-8 mb-4 text-4xl font-extrabold">
        {!appId ? "Build Dashboard" : appId}{" "}
      </h1>
      <p className="mb-8">Monitor build and deployment processes</p>

      <BuildDashboard
        appId={appId}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        repoFilter={repoFilter}
        setRepoFilter={setRepoFilter}
      />
    </div>
  )
}

export default function BuildsClient() {
  return (
    <Suspense fallback={<Spinner size={"m"} />}>
      <BuildsContent />
    </Suspense>
  )
}
