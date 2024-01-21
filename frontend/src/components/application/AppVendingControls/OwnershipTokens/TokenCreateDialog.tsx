import { useTranslation } from "next-i18next"
import { FunctionComponent, useCallback, useState } from "react"
import { Appstream } from "../../../../types/Appstream"
import Button from "../../../Button"
import { vendingApi } from "src/api"
import Modal from "src/components/Modal"
import { useMutation } from "@tanstack/react-query"

interface Props {
  app: Appstream
  updateCallback: CallableFunction
}

/**
 * The button to open a model dialog where application ownership tokens can be generated.
 */
const TokenCreateDialog: FunctionComponent<Props> = ({
  app,
  updateCallback,
}) => {
  const { t } = useTranslation()

  const [shown, setShown] = useState(false)
  const [text, setText] = useState("")

  const names = text.split(/\s*\n\s*/).filter((name) => name !== "")

  const createVendingTokensMutation = useMutation({
    mutationKey: ["create-token", app.id, names],
    mutationFn: () => {
      return vendingApi.createTokensVendingappAppIdTokensPost(app.id, names, {
        withCredentials: true,
      })
    },
    onSuccess: () => {
      updateCallback()
      setText("")
    },
  })

  const textUpdate = useCallback((event) => setText(event.target.value), [])

  return (
    <>
      <Button onClick={() => setShown(true)}>{t("create-tokens")}</Button>
      <Modal
        shown={shown}
        title={t("create-tokens")}
        onClose={() => {
          setShown(false)
          setText("")
        }}
        submitButton={{
          onClick: () => {
            setShown(false)

            if (names.length > 0) {
              createVendingTokensMutation.mutate()
            }
          },
        }}
      >
        <textarea
          placeholder={t("token-creation-placeholder")}
          value={text}
          onChange={textUpdate}
          className="h-40 rounded-xl p-3"
        />
      </Modal>
    </>
  )
}

export default TokenCreateDialog
