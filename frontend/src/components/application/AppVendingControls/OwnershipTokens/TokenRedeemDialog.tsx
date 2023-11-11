import { useTranslation } from "next-i18next"
import { FunctionComponent, useCallback, useState } from "react"
import { toast } from "react-toastify"
import { Appstream } from "../../../../types/Appstream"
import Button from "../../../Button"
import Spinner from "../../../Spinner"
import { useMutation } from "@tanstack/react-query"
import { vendingApi } from "src/api"

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

  const redeemVendingToken = useMutation({
    mutationFn: () => {
      // Strip leading and trailing whitespace characters
      const token = text.trim()

      setText("")

      return vendingApi.redeemTokenVendingappAppIdTokensRedeemTokenPost(
        app.id,
        token,
        {
          withCredentials: true,
        },
      )
    },
    onSuccess: (data) => {
      if (data.data?.status === "failure") {
        toast.error(t("token-failed"))
      }
      if (data.data?.status === "success") {
        toast.success(t("token-redeemed"))
      }
    },
    onError: (error) => {
      toast.error(t(error as string))
    },
  })

  if (redeemVendingToken.isLoading) {
    return <Spinner size={"s"} />
  }

  return (
    <div className="inline-flex gap-2 rounded-xl bg-flathub-white p-4 dark:bg-flathub-arsenic">
      <input
        type="text"
        placeholder={t("token-redeem-placeholder")}
        value={text}
        onChange={textUpdate}
        className="w-80 rounded-xl bg-flathub-gainsborow p-2 dark:bg-flathub-dark-gunmetal"
      />
      <Button
        disabled={text.trim().length === 0}
        onClick={() => redeemVendingToken.mutate()}
      >
        {t("redeem-token")}
      </Button>
    </div>
  )
}

export default TokenRedeemDialog
