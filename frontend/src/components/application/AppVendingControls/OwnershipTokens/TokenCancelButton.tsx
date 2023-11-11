import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import { toast } from "react-toastify"
import { VendingToken } from "../../../../types/Vending"
import Button from "../../../Button"
import Spinner from "../../../Spinner"
import { useMutation } from "@tanstack/react-query"
import { vendingApi } from "src/api"

interface Props {
  token: VendingToken
  appId: string
  setState: React.Dispatch<React.SetStateAction<string>>
}

const TokenCancelButton: FunctionComponent<Props> = ({
  token,
  appId,
  setState,
}) => {
  const { t } = useTranslation()

  const cancelVendingTokens = useMutation({
    mutationFn: () => {
      return vendingApi.cancelTokensVendingappAppIdTokensCancelPost(
        appId,
        [token.id],
        {
          withCredentials: true,
        },
      )
    },
    onSuccess: (data) => {
      if (data.data[0].status === "cancelled") {
        setState("cancelled")
        toast.success(t("token-cancelled"))
      }
    },
    onError: (error) => {
      toast.error(t(error as string))
    },
  })

  if (cancelVendingTokens.isLoading) {
    return <Spinner size="s" />
  }

  // Button is spent after successful use
  if (
    cancelVendingTokens.isSuccess &&
    cancelVendingTokens.data.data[0].status === "cancelled"
  ) {
    return <></>
  }

  return (
    <Button variant="destructive" onClick={() => cancelVendingTokens.mutate()}>
      {t("cancel")}
    </Button>
  )
}

export default TokenCancelButton
