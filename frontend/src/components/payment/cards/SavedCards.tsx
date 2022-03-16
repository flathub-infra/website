import { useTranslation } from 'next-i18next'
import { FunctionComponent, ReactElement, useEffect, useState } from 'react'
import { useUserContext } from '../../../context/user-info'
import { REMOVE_CARD_URL, WALLET_INFO_URL } from '../../../env'
import { PaymentCard } from '../../../types/Payment'
import Button from '../../Button'
import Spinner from '../../Spinner'
import CardInfo from './CardInfo'
import styles from './SavedCards.module.scss'

async function getCards() {
  const res = await fetch(WALLET_INFO_URL, { credentials: 'include' })
  const data = await res.json()
  return data.cards
}

async function deleteCard(card: PaymentCard) {
  fetch(REMOVE_CARD_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(card),
  })
}

const SavedCards: FunctionComponent = () => {
  const { t } = useTranslation()
  const user = useUserContext()

  const [fetched, setFetched] = useState(false)
  // User may have no cards saved, so unloaded state is not empty array
  const [cards, setCards] = useState<PaymentCard[]>(null)

  // Cards should only be retrieved once, and can only be when logged in
  useEffect(() => {
    if (user.info && !fetched) {
      setFetched(true)
      getCards().then(setCards)
    }
  }, [user, fetched])

  // Nothing to show if not logged in
  if (!user.info) {
    return <></>
  }

  if (!cards) {
    return <Spinner size={100} text={t('loading-saved-payment-methods')} />
  }

  let content: ReactElement
  if (cards.length) {
    content = (
      <>
        {cards.map((card) => (
          <div key={card.id}>
            <CardInfo card={card} />
            <Button type='secondary' onClick={() => removeCard(card)}>
              {t('remove-saved-card')}
            </Button>
          </div>
        ))}
      </>
    )
  } else {
    content = <p>{t('no-saved-payment-methods')}</p>
  }

  return (
    <div className='main-container'>
      <h3>{t('saved-cards')}</h3>
      <div className={styles.cardList}>{content}</div>
    </div>
  )

  function removeCard(toRemove: PaymentCard) {
    deleteCard(toRemove).then(() => {
      const cardsCopy = cards.slice()

      cardsCopy.splice(cards.findIndex((card) => card.id === toRemove.id))

      setCards(cardsCopy)
    })
  }
}

export default SavedCards
