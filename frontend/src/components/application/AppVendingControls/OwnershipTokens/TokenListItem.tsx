import { DisclosureButton, DisclosurePanel } from "@headlessui/react"
import { useTranslation } from "next-i18next"
import { useState } from "react"
import { FunctionComponent } from "react"
import { HiChevronUp } from "react-icons/hi2"
import TokenCancelButton from "./TokenCancelButton"
import { TokenModel } from "src/codegen"
import { format } from "date-fns"
import clsx from "clsx"

interface Props {
  open: boolean
  token: TokenModel
  appId: string
}

const TokenListItem: FunctionComponent<Props> = ({ open, token, appId }) => {
  const { t } = useTranslation()

  const [state, setState] = useState(token.state)

  return (
    <>
      <DisclosureButton className="flex justify-between rounded-lg border p-2 hover:opacity-80 focus:outline-none focus-visible:ring focus-visible:ring-opacity-75">
        <div className="grid w-full grid-cols-3 justify-items-start">
          <span>{token.id}</span>
          <span>{token.name}</span>
          <span>{t(`status-${state}`)}</span>
        </div>
        <HiChevronUp
          className={clsx("text-2xl transition", !open && "rotate-180")}
        />
      </DisclosureButton>
      <DisclosurePanel className="flex flex-wrap justify-between gap-y-4 pe-4 ps-4">
        <div className="flex flex-col gap-4">
          {token.token && <span>{token.token}</span>}
          <span>
            {t("transaction-summary-created")} {format(token.created, "PP")}
          </span>
        </div>
        {state === "unredeemed" && (
          <TokenCancelButton token={token} appId={appId} setState={setState} />
        )}
      </DisclosurePanel>
    </>
  )
}

export default TokenListItem
