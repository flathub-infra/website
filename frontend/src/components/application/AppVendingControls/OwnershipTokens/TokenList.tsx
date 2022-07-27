import { Disclosure } from "@headlessui/react"
import { useTranslation } from "next-i18next"
import { FunctionComponent, ReactElement, useCallback } from "react"
import { getVendingTokens } from "../../../../asyncs/vending"
import { useAsync } from "../../../../hooks/useAsync"
import { Appstream } from "../../../../types/Appstream"
import Spinner from "../../../Spinner"
import TokenCreateDialog from "./TokenCreateDialog"
import TokenListItem from "./TokenListItem"

interface Props {
  app: Appstream
}

/**
 * The control elements to view and add/cancel ownership tokens for an app.
 */
const TokenList: FunctionComponent<Props> = ({ app }) => {
  const { t } = useTranslation()

  const {
    value: tokens,
    status,
    error,
  } = useAsync(useCallback(() => getVendingTokens(app.id), [app.id]))

  if (["pending", "idle"].includes(status)) {
    return <Spinner size="m" />
  }

  let content: ReactElement
  if (error) {
    content = <p>{t(error)}</p>
  } else {
    content = (
      <div className="flex flex-col gap-2 rounded-2xl bg-bgColorSecondary p-2">
        {tokens.tokens.map((token) => (
          <Disclosure key={token.id}>
            {({ open }) => (
              <TokenListItem open={open} token={token} appId={app.id} />
            )}
          </Disclosure>
        ))}
        <TokenCreateDialog app={app} />
      </div>
    )
  }

  return (
    <>
      <h3>{t("ownership-tokens")}</h3>
      {content}
    </>
  )
}

export default TokenList
