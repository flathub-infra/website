import { Disclosure } from "@headlessui/react"
import { useTranslations } from "next-intl"
import { FunctionComponent, ReactElement, useState } from "react"
import { Appstream } from "../../../../types/Appstream"
import Spinner from "../../../Spinner"
import TokenCreateDialog from "./TokenCreateDialog"
import TokenListItem from "./TokenListItem"
import { useQuery } from "@tanstack/react-query"
import { getRedeemableTokensVendingappAppIdTokensGet } from "src/codegen"

interface Props {
  app: Pick<Appstream, "id">
}

/**
 * The control elements to view and add/cancel ownership tokens for an app.
 */
const TokenList: FunctionComponent<Props> = ({ app }) => {
  const t = useTranslations()

  const query = useQuery({
    queryKey: ["redeemable-tokens", app.id],
    queryFn: () =>
      getRedeemableTokensVendingappAppIdTokensGet(app.id, {
        credentials: "include",
      }),
    enabled: !!app.id,
  })

  if (query.isPending) {
    return <Spinner size="m" />
  }

  let content: ReactElement
  if (query.isError || query.data.status !== 200) {
    content = <p>{t(query.error.message)}</p>
  } else {
    content = (
      <div className="flex flex-col gap-2 rounded-2xl bg-flathub-white dark:bg-flathub-arsenic">
        {query.data?.data?.tokens?.map((token) => (
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

  return <>{content}</>
}

export default TokenList
