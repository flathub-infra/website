import { translationMessages } from "i18n/request"
import { GetStaticProps } from "next"

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

export const getStaticProps: GetStaticProps = async ({
  locale,
}: {
  locale: string
}) => {
  return {
    props: {
      messages: await translationMessages(locale),
    },
  }
}
