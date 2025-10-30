"use client"

import InstallFallback from "../../../../../src/components/application/InstallFallback"
import { GetAppstreamAppstreamAppIdGet200 } from "src/codegen"

interface InstallClientProps {
  app: Pick<GetAppstreamAppstreamAppIdGet200, "id" | "name" | "icon">
}

export default function InstallClient({ app }: InstallClientProps) {
  return (
    <>
      <meta
        httpEquiv="refresh"
        content={`0; url=/apps/${app.id}/flatpakhttps`}
      />
      <InstallFallback app={app} />
    </>
  )
}
