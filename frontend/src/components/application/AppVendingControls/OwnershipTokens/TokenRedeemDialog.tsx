import { useTranslation } from "next-i18next"
import { FunctionComponent, useCallback, useEffect, useState } from "react"
import { toast } from "react-toastify"
import { VendingTokenRedemption } from "src/types/Vending"
import { redeemVendingToken } from "../../../../asyncs/vending"
import { useAsync } from "../../../../hooks/useAsync"
import { Appstream } from "../../../../types/Appstream"
import Button from "../../../Button"
import Spinner from "../../../Spinner"

interface Props {
  app: Appstream
}

/**
 * A set of controls for redemption of application ownership tokens.
 */
const TokenRedeemDialog: FunctionComponent<Props> = ({ app }) => {
  const { t } = useTranslation()

  const [text, setText] = useState("")

  const textUpdate = useCallback((event) => setText(event.target.value), [])
  const {
    execute: onSubmit,
    value,
    status,
    error,
  } = useAsync<VendingTokenRedemption>(
    useCallback(() => {
      // Strip leading and trailing whitespace characters
      const token = text.trim()

      setText("")

      return token !== ""
        ? redeemVendingToken(app.id, token)
        : Promise.resolve(null)
    }, [app.id, text]),
    false,
  )

  useEffect(() => {
    if (error) {
      toast.error(t(error))
    }
  }, [t, error])

  useEffect(() => {
    if (value?.status === "failure") {
      toast.error(t("token-failed"))
    }
    if (value?.status === "success") {
      toast.success(t("token-redeemed"))
    }
  }, [value, t])

  if (status === "pending") {
    return <Spinner size={"s"} />
  }

  return (
    <div className="inline-flex gap-2 rounded-xl bg-bgColorSecondary p-4">
      <input
        type="text"
        placeholder={t("token-redeem-placeholder")}
        value={text}
        onChange={textUpdate}
        className="w-80 rounded-xl bg-bgColorPrimary p-2"
      />
      <Button onClick={onSubmit}>{t("redeem-token")}</Button>
    </div>
  )
}

export default TokenRedeemDialog
