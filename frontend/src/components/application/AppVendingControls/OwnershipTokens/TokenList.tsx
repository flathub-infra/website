import { Disclosure } from "@headlessui/react"
import { useTranslation } from "next-i18next"
import { FunctionComponent, ReactElement, useState } from "react"
import { Appstream } from "../../../../types/Appstream"
import Spinner from "../../../Spinner"
import TokenCreateDialog from "./TokenCreateDialog"
import TokenListItem from "./TokenListItem"
import { vendingApi } from "src/api"
import { TokenList as TokenListType } from "src/codegen"
import { useQuery } from "@tanstack/react-query"

interface Props {
  app: Appstream
}

/**
 * The control elements to view and add/cancel ownership tokens for an app.
 */
const TokenList: FunctionComponent<Props> = ({ app }) => {
  const { t } = useTranslation()

  const [tokens, setTokens] = useState<TokenListType>(null)

  const query = useQuery({
    queryKey: ["redeemable-tokens", app.id],
    queryFn: async () => {
      const fetch =
        await vendingApi.getRedeemableTokensVendingappAppIdTokensGet(app.id, {
          withCredentials: true,
        })
      setTokens(fetch.data)
    },
    enabled: !!app.id,
  })

  if (query.isPending) {
    return <Spinner size="m" />
  }

  let content: ReactElement
  if (query.isError) {
    content = <p>{t(query.error.message)}</p>
  } else {
    content = (
      <div className="flex flex-col gap-2 rounded-2xl bg-flathub-white p-2 dark:bg-flathub-arsenic">
        {tokens?.tokens.map((token) => (
          <Disclosure key={token.id}>
            {({ open }) => (
              <TokenListItem open={open} token={token} appId={app.id} />
            )}
          </Disclosure>
        ))}
        <TokenCreateDialog app={app} updateCallback={query.refetch} />
      </div>
    )
  }

  return (
    <>
      <h2 className="mb-6 text-2xl font-bold">{t("ownership-tokens")}</h2>
      {content}
    </>
  )
}

export default TokenList
