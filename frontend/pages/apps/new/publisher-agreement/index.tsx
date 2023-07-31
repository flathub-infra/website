import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { useRouter } from "next/router"
import PublisherAgreement from "src/components/user/PublisherAgreement"

const PublisherAgreementPage = () => {
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

export default PublisherAgreementPage

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  }
}
