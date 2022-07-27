import { useTranslation } from "next-i18next"
import { FunctionComponent, useCallback, useEffect } from "react"
import { toast } from "react-toastify"
import { cancelVendingTokens } from "../../../../asyncs/vending"
import { useAsync } from "../../../../hooks/useAsync"
import { VendingToken } from "../../../../types/Vending"
import Button from "../../../Button"
import Spinner from "../../../Spinner"

interface Props {
  token: VendingToken
  appId: string
}

const TokenCancelButton: FunctionComponent<Props> = ({ token, appId }) => {
  const { t } = useTranslation()

  const {
    execute: onClick,
    value,
    status,
    error,
  } = useAsync(
    useCallback(
      () => cancelVendingTokens(appId, [token.token]),
      [appId, token.token],
    ),
    false,
  )

  useEffect(() => {
    if (error) {
      toast.error(t(error))
    }
  }, [t, error])

  if (status === "pending") {
    return <Spinner size="s" />
  }

  // Button is spent after successful use
  if (status === "success" && value?.[0].status === "cancelled") {
    return <></>
  }

  return (
    <Button variant="destructive" onClick={onClick}>
      {t("cancel")}
    </Button>
  )
}

export default TokenCancelButton
