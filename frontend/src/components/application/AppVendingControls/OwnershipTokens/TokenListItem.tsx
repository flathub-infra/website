import { Disclosure } from "@headlessui/react"
import { useTranslation } from "next-i18next"
import { useState } from "react"
import { FunctionComponent } from "react"
import { HiChevronDown, HiChevronUp } from "react-icons/hi2"
import { VendingToken } from "../../../../types/Vending"
import TokenCancelButton from "./TokenCancelButton"

interface Props {
  open: boolean
  token: VendingToken
  appId: string
}

const TokenListItem: FunctionComponent<Props> = ({ open, token, appId }) => {
  const { t } = useTranslation()

  const [state, setState] = useState(token.state)

  return (
    <>
      <Disclosure.Button className="flex justify-between rounded-lg border p-2 hover:bg-colorHighlight focus:outline-none focus-visible:ring focus-visible:ring-opacity-75">
        <div className="grid w-full grid-cols-3 justify-items-start">
          <span>{token.id}</span>
          <span>{token.name}</span>
          <span>{t(`status-${state}`)}</span>
        </div>
        {!open ? (
          <HiChevronUp className="text-2xl" />
        ) : (
          <HiChevronDown className="text-2xl" />
        )}
      </Disclosure.Button>
      <Disclosure.Panel className="flex flex-wrap justify-between gap-y-4 pl-4 pr-4">
        <div className="flex flex-col gap-4">
          <span>{token.token}</span>
          <span>
            {t("transaction-summary-created", { date: token.created })}
          </span>
        </div>
        {state === "unredeemed" && (
          <TokenCancelButton token={token} appId={appId} setState={setState} />
        )}
      </Disclosure.Panel>
    </>
  )
}

export default TokenListItem
