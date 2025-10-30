"use client"

import { useMutation } from "@tanstack/react-query"
import { ReactElement, useEffect } from "react"
import { useTranslations } from "next-intl"
import LoginGuard from "../../../../../../src/components/login/LoginGuard"
import {
  useUserContext,
  useUserDispatch,
} from "../../../../../../src/context/user-info"
import { getUserData } from "../../../../../../src/asyncs/login"
import {
  acceptInviteInvitesAppIdAcceptPost,
  declineInviteInvitesAppIdDeclinePost,
  GetAppstreamAppstreamAppIdGet200,
  useGetInviteStatusInvitesAppIdGet,
} from "../../../../../../src/codegen"
import { Button } from "../../../../../../@/components/ui/button"
import { useRouter } from "src/i18n/navigation"

interface Props {
  app: Pick<GetAppstreamAppstreamAppIdGet200, "id" | "name">
}

export default function AcceptInviteClient({ app }: Props) {
  const t = useTranslations()
  const router = useRouter()
  const user = useUserContext()
  const userDispatch = useUserDispatch()

  useEffect(() => {
    if (user.info?.dev_flatpaks?.includes(app.id)) {
      router.push(`/apps/manage/${app.id}`)
    }
  }, [app.id, router, user.info])

  const inviteQuery = useGetInviteStatusInvitesAppIdGet(app.id, {
    axios: { withCredentials: true },
    query: { enabled: !!app.id },
  })

  const acceptInviteMutation = useMutation({
    mutationKey: ["accept-invite", app.id],
    mutationFn: () =>
      acceptInviteInvitesAppIdAcceptPost(app.id, {
        withCredentials: true,
      }),
    onSuccess: async () => {
      await getUserData(userDispatch)
    },
  })

  const declineInviteMutation = useMutation({
    mutationKey: ["decline-invite", app.id],
    mutationFn: () =>
      declineInviteInvitesAppIdDeclinePost(app.id, {
        withCredentials: true,
      }),
    onSuccess: async () => {
      await getUserData(userDispatch)
      router.push("/developer-portal")
    },
  })

  let content: ReactElement

  if (inviteQuery.data?.data?.is_pending) {
    content = (
      <>
        <div className="flex flex-col items-center justify-center">
          <h2 className="mb-8 text-2xl font-bold">{t("developer-invited")}</h2>

          <div className="mt-8 w-1/2 space-y-4">
            <Button
              size="xl"
              onClick={async () => {
                if (user.info?.accepted_publisher_agreement_at) {
                  acceptInviteMutation.mutate()
                } else {
                  router.push(
                    `/apps/manage/${app.id}/accept-invite/publisher-agreement`,
                  )
                }
              }}
              className="block w-full"
            >
              {t("accept")}
            </Button>

            <Button
              size="xl"
              onClick={() => {
                declineInviteMutation.mutate()
              }}
              className="block w-full"
              variant="secondary"
            >
              {t("decline")}
            </Button>
          </div>
        </div>
      </>
    )
  } else {
    content = (
      <>
        <div className="flex flex-col items-center justify-center">
          <h2 className="mb-8 text-2xl font-bold">{t("invite-not-found")}</h2>
          <p className="w-1/2">{t("invite-not-found-description")}</p>
        </div>
      </>
    )
  }

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <LoginGuard>
        <div className="space-y-8">
          <div>
            <h1 className="mt-8 text-4xl font-extrabold">{app.name}</h1>
            <div className="text-sm opacity-75">{t("developer-settings")}</div>
          </div>
          {content}
        </div>
      </LoginGuard>
    </div>
  )
}
