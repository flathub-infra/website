import { useTranslation } from "next-i18next"
import { FunctionComponent, useCallback, useState } from "react"
import { Appstream } from "../../../../types/Appstream"
import Button from "../../../Button"
import { vendingApi } from "src/api"
import Modal from "src/components/Modal"

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

  const textUpdate = useCallback((event) => setText(event.target.value), [])
  const onSubmit = useCallback(async () => {
    setShown(false)

    // Strip leading and trailing whitespace characters
    const names = text.split(/\s*\n\s*/).filter((name) => name !== "")

    if (names.length > 0) {
      await vendingApi.createTokensVendingappAppIdTokensPost(app.id, names, {
        withCredentials: true,
      })
      updateCallback()
      setText("")
    }
  }, [app.id, text, updateCallback])

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
        submitButton={{ onClick: onSubmit }}
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
