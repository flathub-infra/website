import { GetStaticPaths, GetStaticProps } from "next"
import { useTranslations } from "next-intl"

import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import { ReactElement } from "react"
import Breadcrumbs from "../../../src/components/Breadcrumbs"
import TransactionDetails from "../../../src/components/payment/transactions/TransactionDetails"
import Spinner from "../../../src/components/Spinner"
import LoginGuard from "../../../src/components/login/LoginGuard"
import { useGetTransactionByIdWalletTransactionsTxnGet } from "src/codegen"
import { translationMessages } from "i18n/request"

export default function TransactionPage() {
  const t = useTranslations()
  const router = useRouter()

  const query = useGetTransactionByIdWalletTransactionsTxnGet(
    router.query.transaction_id as string,
    {
      axios: {
        withCredentials: true,
      },
      query: {
        enabled: !!router.query.transaction_id,
      },
    },
  )

  let content: ReactElement

  if (query.isFetching) {
    content = <Spinner size="l" />
  } else if (query.isError) {
    content = (
      <>
        <h1 className="my-8 text-4xl font-extrabold">{t("whoops")}</h1>
        <p>{t(query.error.message)}</p>
      </>
    )
  } else {
    content = <TransactionDetails transaction={query.data.data} />
  }

  const pages = [
    {
      href: "/wallet",
      name: t("user-wallet"),
      current: false,
    },
    {
      href: `/payment/details/${router.query.transaction_id}`,
      name: t("transaction-summary"),
      current: true,
    },
  ]

  return (
    <>
      <NextSeo title={t("transaction-summary")} noindex />
      <div className="max-w-11/12 mx-auto my-0 w-11/12 pt-4 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <LoginGuard>
          <Breadcrumbs pages={pages} />
          {content}
        </LoginGuard>
      </div>
    </>
  )
}

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

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  }
}
