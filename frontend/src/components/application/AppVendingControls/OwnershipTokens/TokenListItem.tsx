import { DisclosureButton, DisclosurePanel } from "@headlessui/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { FunctionComponent } from "react"
import { ChevronUpIcon } from "@heroicons/react/24/solid"
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
  const t = useTranslations()

  const [state, setState] = useState(token.state)

  return (
    <>
      <DisclosureButton className="flex justify-between rounded-lg border p-2 hover:opacity-80 focus:outline-hidden focus-visible:ring-3 focus-visible:ring-opacity-75">
        <div className="flex w-full">
          <div>{token.name}</div>
          <div className="ms-auto pe-8">{t(`status-${state}`)}</div>
        </div>
        <ChevronUpIcon
          className={clsx("text-2xl size-6 transition", !open && "rotate-180")}
        />
      </DisclosureButton>
      <DisclosurePanel className="flex flex-wrap justify-between gap-y-4 pe-4 ps-4">
        <div className="grid w-full xl:grid-cols-3 justify-items-start items-center">
          {token.token && <div>{token.token}</div>}
          <div>
            {t("transaction-summary-created")} {format(token.created, "PP")}
          </div>
          <div className="justify-self-end">
            {state === "unredeemed" && (
              <TokenCancelButton
                token={token}
                appId={appId}
                setState={setState}
              />
            )}
          </div>
        </div>
      </DisclosurePanel>
    </>
  )
}

export default TokenListItem
