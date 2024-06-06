import { useRouter } from "next/router"
import { FunctionComponent, ReactElement, useState } from "react"
import { TransactionDetailed } from "../../../types/Payment"
import Spinner from "../../Spinner"
import TransactionCancelButton from "../transactions/TransactionCancelButton"
import CardSelect from "./CardSelect"
import PaymentForm from "./PaymentForm"
import TermsAgreement from "./TermsAgreement"
import { useQuery } from "@tanstack/react-query"
import { getWalletinfoWalletWalletinfoGet } from "src/codegen"

enum Stage {
  TermsAgreement,
  CardSelect,
  CardInput,
}

const detailsPage = `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/payment/details`

const TransactionCancelButtonPrep = ({
  transactionId,
}: {
  transactionId: string
}) => {
  const router = useRouter()
  return (
    <TransactionCancelButton
      id={transactionId}
      className="w-full sm:w-auto"
      onSuccess={() =>
        router.push(`${detailsPage}/${transactionId}`, undefined, {
          locale: router.locale,
        })
      }
    />
  )
}

const Checkout: FunctionComponent<{
  transaction: TransactionDetailed | null
  clientSecret: string
}> = ({ transaction, clientSecret }) => {
  const router = useRouter()

  // For purchases the user must agree to the T&C's before continuing
  const [currentStage, setStage] = useState(
    transaction.summary.kind === "purchase"
      ? Stage.TermsAgreement
      : Stage.CardSelect,
  )
  const [termsAgreed, setTermsAgreed] = useState(
    transaction.summary.kind === "purchase" ? false : true,
  )

  // Cards should only be retrieved once
  const walletQuery = useQuery({
    queryKey: ["/walletinfo"],
    queryFn: async ({ signal }) => {
      const wallet = await getWalletinfoWalletWalletinfoGet({
        withCredentials: true,
        signal,
      })

      // User may have no saved cards to select from
      setStage(
        wallet.data.cards.length > 0 ? Stage.CardSelect : Stage.CardInput,
      )

      return wallet
    },
    enabled: termsAgreed,
  })

  if (walletQuery.isPending || !transaction) {
    return <Spinner size="m" />
  }

  const { id: transactionId } = transaction.summary

  const { data, error } = walletQuery
  const cards = data?.data.cards ?? []

  let flowContent: ReactElement
  switch (currentStage) {
    case Stage.TermsAgreement:
      flowContent = (
        <TermsAgreement
          onConfirm={() => setTermsAgreed(true)}
          transactionCancelButton={
            <TransactionCancelButtonPrep transactionId={transactionId} />
          }
        />
      )
      break
    case Stage.CardSelect:
      flowContent = (
        <CardSelect
          transaction={transaction}
          clientSecret={clientSecret}
          cards={cards}
          error={walletQuery.isError ? "failed-to-load-refresh" : null}
          submit={() =>
            router.push(`${detailsPage}/${transactionId}`, undefined, {
              locale: router.locale,
            })
          }
          skip={() => setStage(Stage.CardInput)}
          transactionCancelButton={
            <TransactionCancelButtonPrep transactionId={transactionId} />
          }
        />
      )
      break
    case Stage.CardInput:
      flowContent = (
        <PaymentForm
          transactionId={transactionId}
          callbackPage={`${detailsPage}/${transactionId}`}
          canGoBack={cards.length > 0}
          goBack={() => setStage(Stage.CardSelect)}
          transactionCancelButton={
            <TransactionCancelButtonPrep transactionId={transactionId} />
          }
        />
      )
      break
    // Loading is a safe default rendering
    default:
      flowContent = <Spinner size="m" />
  }

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <div className="flex flex-col gap-5">{flowContent}</div>
    </div>
  )
}

export default Checkout
