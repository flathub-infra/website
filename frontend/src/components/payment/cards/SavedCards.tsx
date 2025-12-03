import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { FunctionComponent, ReactNode } from "react"
import DeleteCardButton from "./DeleteCardButton"
import { getWalletinfoWalletWalletinfoGet } from "src/codegen"
import { CardInfo, CardInfoSkeleton } from "./CardInfo"
import { CreditCardIcon } from "@heroicons/react/24/outline"

const SavedCards: FunctionComponent = () => {
  const t = useTranslations()

  const walletQuery = useQuery({
    queryKey: ["/walletinfo"],
    queryFn: ({ signal }) =>
      getWalletinfoWalletWalletinfoGet({
        withCredentials: true,
        signal,
      }),
  })

  if (walletQuery.isPending) {
    return (
      <div className="rounded-2xl bg-flathub-white p-6 shadow-lg dark:bg-flathub-arsenic/80 border border-flathub-gainsborow/30 dark:border-flathub-granite-gray/20">
        <div className="flex items-center gap-3 mb-4">
          <CreditCardIcon className="size-6 text-flathub-celestial-blue" />
          <h3 className="text-xl font-semibold">{t("saved-cards")}</h3>
        </div>
        <CardInfoSkeleton />
      </div>
    )
  }

  let content: ReactNode
  if (walletQuery.isError) {
    content = (
      <p className="text-flathub-sonic-silver dark:text-flathub-spanish-gray">
        {t("failed-to-load-refresh")}
      </p>
    )
  }

  if (walletQuery.isSuccess) {
    content =
      walletQuery.data.data.cards.length == 0 ? (
        <p className="text-flathub-sonic-silver dark:text-flathub-spanish-gray">
          {t("no-saved-payment-methods")}
        </p>
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
    <div className="rounded-2xl bg-flathub-white p-6 shadow-lg dark:bg-flathub-arsenic/80 border border-flathub-gainsborow/30 dark:border-flathub-granite-gray/20">
      <div className="flex items-center gap-3 mb-4">
        <CreditCardIcon className="size-6 text-flathub-celestial-blue" />
        <h3 className="text-xl font-semibold">{t("saved-cards")}</h3>
      </div>
      {content}
    </div>
  )
}

export default SavedCards
