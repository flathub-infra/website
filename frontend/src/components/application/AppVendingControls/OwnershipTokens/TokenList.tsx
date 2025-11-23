import { Disclosure } from "@headlessui/react"
import { useTranslations } from "next-intl"
import { FunctionComponent, ReactElement, useState } from "react"
import Spinner from "../../../Spinner"
import TokenCreateDialog from "./TokenCreateDialog"
import TokenListItem from "./TokenListItem"
import Pagination from "../../../Pagination"
import { useQuery } from "@tanstack/react-query"
import {
  GetAppstreamAppstreamAppIdGet200,
  getRedeemableTokensVendingappAppIdTokensGet,
} from "src/codegen"

interface Props {
  app: Pick<GetAppstreamAppstreamAppIdGet200, "id">
}

/**
 * The control elements to view and add/cancel ownership tokens for an app.
 */
const TokenList: FunctionComponent<Props> = ({ app }) => {
  const t = useTranslations()
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const query = useQuery({
    queryKey: ["redeemable-tokens", app.id, currentPage],
    queryFn: () =>
      getRedeemableTokensVendingappAppIdTokensGet(
        app.id,
        { page: currentPage, page_size: pageSize },
        { withCredentials: true },
      ),
    enabled: !!app.id,
  })

  if (query.isPending) {
    return <Spinner size="m" />
  }

  if (query.isError) {
    return <p>{t(query.error.message)}</p>
  }

  const pagination = query.data?.data?.pagination
  const totalPages = pagination?.total_pages || 0
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  const tokens = query.data?.data?.tokens || []

  const handleRefetch = async () => {
    const result = await query.refetch()
    const newTotalPages = result.data?.data?.pagination?.total_pages || 1
    setCurrentPage(newTotalPages)
  }

  return (
    <div className="space-y-4">
      {tokens.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl bg-flathub-white dark:bg-flathub-arsenic">
          {tokens.map((token) => (
            <Disclosure key={token.id}>
              {({ open }) => (
                <TokenListItem open={open} token={token} appId={app.id} />
              )}
            </Disclosure>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          pages={pages}
          onClick={setCurrentPage}
        />
      )}

      <TokenCreateDialog app={app} updateCallback={handleRefetch} />
    </div>
  )
}

export default TokenList
