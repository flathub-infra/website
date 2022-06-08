import { useTranslation } from "next-i18next"
import Router from "next/router"
import React, {
  FormEvent,
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from "react"
import { toast } from "react-toastify"
import { initiateAppPayment } from "../../asyncs/vending"
import { useAsync } from "../../hooks/useAsync"
import Button from "../Button"
import CurrencyInput from "../CurrencyInput"
import Spinner from "../Spinner"

const minDonation = 5

interface Props {
  appId: string
}

const PurchaseInput: FunctionComponent<Props> = ({ appId }) => {
  const { t } = useTranslation()

  const [amount, setAmount] = useState(minDonation.toFixed(2))
  const {
    execute: submit,
    status,
    value,
    error,
  } = useAsync(
    useCallback(
      () =>
        initiateAppPayment(appId, {
          currency: "usd",
          amount: Number(amount) * 100,
        }),
      [appId, amount],
    ),
    false,
  )

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      submit()
    },
    [submit],
  )

  useEffect(() => {
    if (error) {
      toast.error(t(error))
    }
  }, [error, t])

  useEffect(() => {
    if (value) {
      Router.push(`/payment/${value.transaction}`)
    }
  }, [value])

  if (status == "pending") {
    return <Spinner size="s" />
  }

  return (
    <form
      className="my-5 mx-0 flex flex-col gap-5 rounded-xl bg-bgColorSecondary p-5"
      onSubmit={handleSubmit}
    >
      {/* <h4 className="m-0">{t("select-donation-amount")}</h4> */}
      <div className="flex flex-wrap items-center justify-center gap-5">
        <CurrencyInput value={amount} setValue={setAmount} minimum={5} />
      </div>
      <Button>{t("kind-purchase")}</Button>
    </form>
  )
}

export default PurchaseInput
