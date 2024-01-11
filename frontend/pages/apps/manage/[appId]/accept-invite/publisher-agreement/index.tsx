import { GetStaticPaths, GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { useRouter } from "next/router"
import { useTranslation } from "next-i18next"
import PublisherAgreement from "src/components/user/PublisherAgreement"
import { useUserDispatch } from "src/context/user-info"
import { inviteApi } from "src/api"
import { getUserData } from "src/asyncs/login"

interface Props {
  appId: string
}

const PublisherAgreementPage = ({ appId }: Props) => {
  const { t } = useTranslation()
  const router = useRouter()
  const userDispatch = useUserDispatch()

  return (
    <PublisherAgreement
      continueText={t("accept-invite")}
      onAccept={async () => {
        await inviteApi.acceptInviteInvitesAppIdAcceptPost(appId, {
          withCredentials: true,
        })
        await getUserData(userDispatch)
        router.push(`/apps/manage/${appId}`)
      }}
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
}) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
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
