import { useTranslation } from "next-i18next"
import { FunctionComponent, ReactElement, useEffect, useState } from "react"
import { toast } from "react-toastify"
import { useUserContext } from "../../../context/user-info"
import { REMOVE_CARD_URL, WALLET_INFO_URL } from "../../../env"
import { PaymentCard } from "../../../types/Payment"
import Button from "../../Button"
import Spinner from "../../Spinner"
import CardInfo from "./CardInfo"
import styles from "./SavedCards.module.scss"

/**
 * Performs API request to retrieve details of all cards the user has saved
 * @returns array of saved cards
 */
async function getCards() {
  let res: Response
  try {
    res = await fetch(WALLET_INFO_URL, { credentials: "include" })
  } catch {
    throw "failed-to-load-refresh"
  }

  if (res.ok) {
    // Not checking status, server only complains if not logged in (which we enforce)
    const data = await res.json()
    return data.cards
  } else {
    throw "failed-to-load-refresh"
  }
}

/**
 * Performs API request to delete a saved payment card
 * @param card the card to be deleted
 */
async function deleteCard(card: PaymentCard) {
  let res: Response
  try {
    res = await fetch(REMOVE_CARD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(card),
    })
  } catch {
    throw "network-error-try-again"
  }

  if (!res.ok) {
    throw "network-error-try-again"
  }
}

const SavedCards: FunctionComponent = () => {
  const { t } = useTranslation()
  const user = useUserContext()

  const [fetched, setFetched] = useState(false)
  // User may have no cards saved, so unloaded state is not empty array
  const [cards, setCards] = useState<PaymentCard[]>(null)
  const [error, setError] = useState("")

  // Cards should only be retrieved once, and can only be when logged in
  useEffect(() => {
    if (user.info && !fetched) {
      setFetched(true)
      getCards().then(setCards).catch(setError)
    }
  }, [user, fetched])

  // Nothing to show if not logged in
  if (!user.info) {
    return <></>
  }

  if (!cards && !error) {
    return <Spinner size={100} text={t("loading-saved-payment-methods")} />
  }

  let content: ReactElement
  if (!error && cards.length) {
    content = (
      <>
        {cards.map((card) => (
          <div key={card.id}>
            <CardInfo card={card} />
            <Button variant="secondary" onClick={() => removeCard(card)}>
              {t("remove-saved-card")}
            </Button>
          </div>
        ))}
      </>
    )
  } else {
    content = <p>{error ? t(error) : t("no-saved-payment-methods")}</p>
  }

  return (
    <div className="main-container">
      <h3>{t("saved-cards")}</h3>
      <div className={styles.cardList}>{content}</div>
    </div>
  )

  /**
   * Sends API request to delete a saved card, then removes the local rendered copy
   * @param toRemove the card to be removed
   */
  function removeCard(toRemove: PaymentCard) {
    deleteCard(toRemove)
      .then(() => {
        const cardsCopy = cards.slice()

        cardsCopy.splice(cards.findIndex((card) => card.id === toRemove.id))

        setCards(cardsCopy)
      })
      .catch((err) => toast.error(t(err)))
  }
}

export default SavedCards
