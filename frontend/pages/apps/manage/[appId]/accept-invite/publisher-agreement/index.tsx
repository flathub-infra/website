import { GetStaticPaths, GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { useRouter } from "next/router"
import { useTranslation } from "react-i18next"
import { acceptInvite } from "src/asyncs/directUpload"
import PublisherAgreement from "src/components/user/PublisherAgreement"
import { useUserDispatch } from "src/context/user-info"

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
        await acceptInvite(appId, userDispatch)
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
