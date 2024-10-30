import { GetStaticPaths, GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import { ReactElement } from "react"
import Breadcrumbs from "../../../src/components/Breadcrumbs"
import TransactionCancelButton from "../../../src/components/payment/transactions/TransactionCancelButton"
import TransactionDetails from "../../../src/components/payment/transactions/TransactionDetails"
import Spinner from "../../../src/components/Spinner"
import LoginGuard from "../../../src/components/login/LoginGuard"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useGetTransactionByIdWalletTransactionsTxnGet } from "src/codegen"

export default function TransactionPage() {
  const { t } = useTranslation()
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

  let content: ReactElement = <Spinner size="l" />
  if (query.error) {
    content = (
      <>
        <h1 className="my-8 text-4xl font-extrabold">{t("whoops")}</h1>
        <p>{t(query.error.message)}</p>
      </>
    )
  } else if (query.data) {
    const unresolved = ["new", "retry"].includes(query.data.data.summary.status)
    if (unresolved) {
      content = (
        <>
          <h1 className="my-8 text-4xl font-extrabold">{t("whoops")}</h1>
          <p>{t("transaction-went-wrong")}</p>
          <div className="flex gap-3">
            <TransactionCancelButton
              id={query.data.data.summary.id}
              onSuccess={() => router.reload()}
            />
            <Button asChild size="lg">
              <Link href={`/payment/${query.data.data.summary.id}`}>
                {t("retry-checkout")}
              </Link>
            </Button>
          </div>
        </>
      )
    } else {
      content = <TransactionDetails transaction={query.data.data} />
    }
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
      <NextSeo title={t("transaction-summary")} noindex={true}></NextSeo>
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
      ...(await serverSideTranslations(locale, ["common"])),
    },
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  }
}
