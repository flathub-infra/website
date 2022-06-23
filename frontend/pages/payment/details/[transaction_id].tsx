import { GetStaticPaths, GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import Link from "next/link"
import { useRouter } from "next/router"
import { ReactElement, useEffect, useState } from "react"
import Button from "../../../src/components/Button"
import RelatedLink from "../../../src/components/RelatedLink"
import TransactionCancelButton from "../../../src/components/payment/transactions/TransactionCancelButton"
import TransactionDetails from "../../../src/components/payment/transactions/TransactionDetails"
import Spinner from "../../../src/components/Spinner"
import { useUserContext } from "../../../src/context/user-info"
import { TRANSACTION_INFO_URL } from "../../../src/env"
import { TransactionDetailed } from "../../../src/types/Payment"
import LoginGuard from "../../../src/components/login/LoginGuard"

async function getTransaction(transactionId: string) {
  let res: Response
  try {
    res = await fetch(TRANSACTION_INFO_URL(transactionId), {
      credentials: "include",
    })
  } catch {
    throw "failed-to-load-refresh"
  }

  if (res.ok) {
    return await res.json()
  } else {
    throw "failed-to-load-refresh"
  }
}

export default function TransactionPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const user = useUserContext()

  const [transaction, setTransaction] = useState<TransactionDetailed>(null)
  const [error, setError] = useState("")

  // Once router is ready the transaction ID is attainable
  useEffect(() => {
    // Router must be ready to access query parameters
    if (!router.isReady) {
      return
    }

    // Once the transaction ID is known, the associated data can be fetched
    const transaction_id = router.query.transaction_id as string

    getTransaction(transaction_id).then(setTransaction).catch(setError)
  }, [router, user])

  let content: ReactElement = <Spinner size="l" />
  if (error) {
    content = (
      <>
        <h1>{t("whoops")}</h1>
        <p>{t(error)}</p>
      </>
    )
  } else if (transaction) {
    const unresolved = ["new", "retry"].includes(transaction.summary.status)
    if (unresolved) {
      content = (
        <>
          <h1>{t("whoops")}</h1>
          <p>{t("transaction-went-wrong")}</p>
          <div className="flex gap-3">
            <TransactionCancelButton
              id={transaction.summary.id}
              onSuccess={() => router.reload()}
            />
            <Link href={`/payment/${transaction.summary.id}`} passHref>
              <Button>{t("retry-checkout")}</Button>
            </Link>
          </div>
        </>
      )
    } else {
      content = <TransactionDetails transaction={transaction} />
    }
  }

  return (
    <>
      <NextSeo title={t("payment-summary")} noindex={true}></NextSeo>
      <div className="max-w-11/12 my-0 mx-auto w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <LoginGuard>
          <RelatedLink href="/wallet" pageTitle={t("user-wallet")} />
          {content}
        </LoginGuard>
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
    revalidate: 3600,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  }
}
