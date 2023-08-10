import { useTranslation } from "next-i18next"
import { FunctionComponent, useEffect, useState } from "react"
import { toast } from "react-toastify"
import { deleteAccount } from "../../asyncs/login"
import { requestDeletion } from "../../asyncs/user"
import { useUserDispatch } from "../../context/user-info"
import Button from "../Button"
import ConfirmDialog from "../ConfirmDialog"
import Spinner from "../Spinner"
import { useMutation } from "@tanstack/react-query"

const DeleteButton: FunctionComponent = () => {
  const { t } = useTranslation()
  const dispatch = useUserDispatch()

  const [token, setToken] = useState("")

  // Get token first, then use to delete
  const nextAction = token
    ? () => deleteAccount(dispatch, token)
    : requestDeletion

  const deleteUserMutation = useMutation({
    mutationKey: ["delete"],
    mutationFn: async () => await nextAction(),
  })

  // Alert user to network errors preventing deletion
  useEffect(() => {
    if (deleteUserMutation.error) {
      toast.error(t(deleteUserMutation.error as string))
    }
  }, [deleteUserMutation.error, t])

  useEffect(() => {
    if (deleteUserMutation.data) {
      setToken(deleteUserMutation.data)
    }
  }, [deleteUserMutation.data])

  if (deleteUserMutation.isLoading) {
    return <Spinner size="s" />
  }

  return (
    <>
      <Button onClick={() => deleteUserMutation.mutate()} variant="destructive">
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
