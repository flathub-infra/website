"use client"

import { useTranslations } from "next-intl"
import PublisherAgreement from "../../../../../../../src/components/user/PublisherAgreement"
import { useUserDispatch } from "../../../../../../../src/context/user-info"
import { getUserData } from "../../../../../../../src/asyncs/login"
import { useMutation } from "@tanstack/react-query"
import { acceptInviteInvitesAppIdAcceptPost } from "../../../../../../../src/codegen"
import { useRouter } from "src/i18n/navigation"

interface Props {
  appId: string
}

export default function PublisherAgreementClient({ appId }: Props) {
  const t = useTranslations()
  const router = useRouter()
  const userDispatch = useUserDispatch()

  const acceptInviteMutation = useMutation({
    mutationKey: ["accept-invite", appId],
    mutationFn: () =>
      acceptInviteInvitesAppIdAcceptPost(appId, {
        credentials: "include",
      }),
    onSuccess: async () => {
      await getUserData(userDispatch)
      router.push(`/apps/manage/${appId}`)
    },
  })

  return (
    <PublisherAgreement
      continueText={t("accept-invite")}
      onAccept={acceptInviteMutation.mutate}
      onCancel={() => {
        router.back()
      }}
    />
  )
}
