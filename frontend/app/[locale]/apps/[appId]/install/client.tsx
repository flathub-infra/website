"use client"

import { Appstream } from "src/types/Appstream"
import InstallFallback from "../../../../../src/components/application/InstallFallback"

interface InstallClientProps {
  app: Pick<Appstream, "id" | "name" | "icon">
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
