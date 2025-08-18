import { GetStaticPaths, GetStaticProps } from "next"

import { useRouter } from "next/router"
import { useTranslations } from "next-intl"
import PublisherAgreement from "src/components/user/PublisherAgreement"
import { useUserDispatch } from "src/context/user-info"
import { getUserData } from "src/asyncs/login"
import { useMutation } from "@tanstack/react-query"
import { acceptInviteInvitesAppIdAcceptPost } from "src/codegen"
import { translationMessages } from "i18n/request"

interface Props {
  appId: string
}

const PublisherAgreementPage = ({ appId }: Props) => {
  const t = useTranslations()
  const router = useRouter()
  const userDispatch = useUserDispatch()

  const acceptInviteMutation = useMutation({
    mutationKey: ["accept-invite", appId],
    mutationFn: () =>
      acceptInviteInvitesAppIdAcceptPost(appId, {
        withCredentials: true,
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

export default PublisherAgreementPage

export const getStaticProps: GetStaticProps = async ({
  locale,
  params: { appId },
}: {
  locale: string
  params: { appId: string }
}) => {
  return {
    props: {
      messages: await translationMessages(locale),
      appId,
    },
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  }
}
