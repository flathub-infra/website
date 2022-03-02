import { useTranslation } from 'next-i18next'
import { FunctionComponent, useEffect, useState } from 'react'
import { useUserContext } from '../../../context/user-info'
import { WALLET_INFO_URL } from '../../../env'
import { PaymentCard } from '../../../types/Payment'
import Spinner from '../../Spinner'
import CardInfo from './CardInfo'
import styles from './SavedCards.module.scss'

async function getCards(setCards) {
  const res = await fetch(WALLET_INFO_URL, { credentials: 'include' })
  const data = await res.json()
  setCards(data.cards)
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
      getCards(setCards)
    }
  }, [user, fetched])

  // Nothing to show if not logged in
  if (!user.info) {
    return <></>
  }

  if (!cards) {
    return <Spinner size={100} text={t('loading-saved-payment-methods')} />
  }

  return (
    <div className='main-container'>
      <h3>{t('saved-cards')}</h3>
      <div className={styles.cardList}>
        {cards.length ? (
          cards.map((card) => <CardInfo key={card.id} card={card} />)
        ) : (
          <p>No saved payment methods to show.</p>
        )}
      </div>
    </div>
  )
}

export default SavedCards
