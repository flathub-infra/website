import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "next-i18next"
import { FunctionComponent, ReactNode } from "react"
import Spinner from "../../Spinner"
import CardInfo from "./CardInfo"
import DeleteCardButton from "./DeleteCardButton"
import { walletApi } from "src/api"
import { isAxiosError } from "axios"

const SavedCards: FunctionComponent = () => {
  const { t } = useTranslation()

  const walletQuery = useQuery({
    queryKey: ["/walletinfo"],
    queryFn: () =>
      walletApi.getWalletinfoWalletWalletinfoGet({ withCredentials: true }),
  })

  if (walletQuery.isLoading) {
    return <Spinner size="m" text={t("loading-saved-payment-methods")} />
  }

  let content: ReactNode
  if (walletQuery.isError) {
    content = <p>{t("failed-to-load-refresh")}</p>
  }

  if (walletQuery.isSuccess) {
    content =
      walletQuery.data.data.cards.length == 0 ? (
        <p>{t("no-saved-payment-methods")}</p>
      ) : (
        <div className="flex flex-col gap-5 md:flex-row">
          {walletQuery.data.data.cards.map((card) => (
            <div key={card.id} className="flex flex-col items-center gap-2">
              <CardInfo card={card} />
              <DeleteCardButton card={card} />
            </div>
          ))}
        </div>
      )
  }

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <h3 className="my-4 text-xl font-semibold">{t("saved-cards")}</h3>
      {content}
    </div>
  )
}

export default SavedCards
