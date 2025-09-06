"use client"

import PublisherAgreement from "src/components/user/PublisherAgreement"
import type { JSX } from "react"
import { useRouter } from "src/i18n/navigation"

const PublisherAgreementClient = (): JSX.Element => {
  const router = useRouter()

  return (
    <PublisherAgreement
      onAccept={() => {
        router.push("/apps/new/register")
      }}
      onCancel={() => {
        router.back()
      }}
    />
  )
}

export default PublisherAgreementClient
