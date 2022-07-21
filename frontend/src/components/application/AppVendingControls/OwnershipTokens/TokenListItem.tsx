import { Disclosure } from "@headlessui/react"
import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import { MdArrowDropDown, MdArrowDropUp } from "react-icons/md"
import { VendingToken } from "../../../../types/Vending"

interface Props {
  open: boolean
  token: VendingToken
}

const TokenListItem: FunctionComponent<Props> = ({ open, token }) => {
  const { t } = useTranslation()

  return (
    <>
      <Disclosure.Button className="flex justify-between rounded-lg border p-2 hover:bg-colorHighlight focus:outline-none focus-visible:ring focus-visible:ring-opacity-75">
        <span>
          {token.id} - {token.name}
        </span>
        {!open ? (
          <MdArrowDropUp className="text-2xl" />
        ) : (
          <MdArrowDropDown className="text-2xl" />
        )}
      </Disclosure.Button>
      <Disclosure.Panel>
        <span>{t("transaction-summary-created", { date: token.created })}</span>
        <br />
        <span>{t("transaction-summary-status", { status: token.state })}</span>
        <br />
        <span>{token.token}</span>
      </Disclosure.Panel>
    </>
  )
}

export default TokenListItem
