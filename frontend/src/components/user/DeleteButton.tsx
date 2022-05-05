import { useTranslation } from "next-i18next"
import { FunctionComponent, useEffect, useState } from "react"
import { toast } from "react-toastify"
import { deleteAccount } from "../../asyncs/login"
import { requestDeletion } from "../../asyncs/user"
import { useUserDispatch } from "../../context/user-info"
import { useAsync } from "../../hooks/useAsync"
import Button from "../Button"
import ConfirmDialog from "../ConfirmDialog"
import Spinner from "../Spinner"

const DeleteButton: FunctionComponent = () => {
  const { t } = useTranslation()
  const dispatch = useUserDispatch()

  const [token, setToken] = useState("")

  // Get token first, then use to delete
  const nextAction = token
    ? () => deleteAccount(dispatch, token)
    : requestDeletion

  const { execute, status, value, error } = useAsync<void | string>(
    nextAction,
    false,
  )

  // Alert user to network errors preventing deletion
  useEffect(() => {
    if (error) {
      toast.error(t(error))
    }
  }, [error, t])

  useEffect(() => {
    if (value) {
      setToken(value)
    }
  }, [value])

  if (status === "pending") {
    return <Spinner size={30} />
  }

  if (token) {
    return (
      <ConfirmDialog
        prompt={t("delete-account-prompt")}
        entry={t("delete-account-entry")}
        action={t("delete-account")}
        onConfirmed={execute}
        onCancelled={() => setToken("")}
      />
    )
  }

  return (
    <Button onClick={execute} variant="secondary">
      {t("delete-account")}
    </Button>
  )
}

export default DeleteButton
