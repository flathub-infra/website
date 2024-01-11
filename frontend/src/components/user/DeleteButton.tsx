import { useTranslation } from "next-i18next"
import { FunctionComponent, useState } from "react"
import { toast } from "react-toastify"
import { useUserDispatch } from "../../context/user-info"
import Button from "../Button"
import ConfirmDialog from "../ConfirmDialog"
import Spinner from "../Spinner"
import { useMutation } from "@tanstack/react-query"
import { authApi } from "src/api"

const DeleteButton: FunctionComponent = () => {
  const { t } = useTranslation()
  const dispatch = useUserDispatch()

  const [token, setToken] = useState<string>()

  const prepareDeleteUserMutation = useMutation({
    mutationKey: ["prepare-delete"],
    mutationFn: async () =>
      authApi.getDeleteuserAuthDeleteuserGet({
        withCredentials: true,
      }),
    onSuccess: (data) => {
      setToken(data.data.token)
    },
    onError: (e) => {
      toast.error(t("network-error-try-again"))
    },
  })

  const deleteUserMutation = useMutation({
    mutationKey: ["delete"],
    mutationFn: async () =>
      authApi.doDeleteuserAuthDeleteuserPost(
        { token },
        {
          withCredentials: true,
        },
      ),
    onSuccess: () => {
      dispatch({ type: "logout" })
    },
    onError: (e: { response: { data: { detail: string } } }) => {
      if (e.response.data?.detail === "token mismatch") {
        toast.error(t("account-deletion-token-mismatch"))
      } else {
        toast.error(t("network-error-try-again"))
      }
    },
  })

  if (deleteUserMutation.isPending) {
    return <Spinner size="s" />
  }

  return (
    <>
      <Button
        onClick={() => prepareDeleteUserMutation.mutate()}
        variant="destructive"
      >
        {t("delete-account")}
      </Button>

      <ConfirmDialog
        isVisible={!!token}
        prompt={t("delete-account-prompt")}
        entry={t("delete-account-entry")}
        action={t("delete-account")}
        onConfirmed={deleteUserMutation.mutate}
        onCancelled={() => setToken("")}
      />
    </>
  )
}

export default DeleteButton
