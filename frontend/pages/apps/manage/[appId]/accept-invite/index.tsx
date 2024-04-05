import { useMutation, useQuery } from "@tanstack/react-query"
import { GetStaticPaths, GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import { ReactElement, useEffect } from "react"
import { useTranslation } from "next-i18next"
import Button from "src/components/Button"
import LoginGuard from "src/components/login/LoginGuard"
import { useUserContext, useUserDispatch } from "src/context/user-info"
import { fetchAppstream } from "src/fetchers"
import { getUserData } from "src/asyncs/login"
import {
  acceptInviteInvitesAppIdAcceptPost,
  declineInviteInvitesAppIdDeclinePost,
  getInviteStatusInvitesAppIdGet,
} from "src/codegen"

export default function AcceptInvitePage({ app }) {
  const { t } = useTranslation()
  const router = useRouter()
  const user = useUserContext()
  const userDispatch = useUserDispatch()

  useEffect(() => {
    if (user.info?.dev_flatpaks.includes(app.id)) {
      router.push(`/apps/manage/${app.id}`)
    }
  }, [app.id, router, user.info])

  const inviteQuery = useQuery({
    queryKey: ["invite-status", app.id],
    queryFn: () =>
      getInviteStatusInvitesAppIdGet(app.id, {
        withCredentials: true,
      }),
    enabled: !!app.id,
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
      <NextSeo title={t(app.name)} noindex />
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

export const getStaticProps: GetStaticProps = async ({
  locale,
  params: { appId },
}) => {
  const app = (await fetchAppstream(appId as string))?.data

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      app: app ?? { id: appId, name: appId },
    },
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  }
}
