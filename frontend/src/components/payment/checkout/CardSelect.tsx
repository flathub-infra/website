import { FunctionComponent, ReactElement } from 'react'
import { PaymentCard } from '../../../types/Payment'
import Button from '../../Button'
import Spinner from '../../Spinner'
import CardInfo from '../cards/CardInfo'
import styles from '../cards/SavedCards.module.scss'

interface Props {
  cards: PaymentCard[]
  select: (card: PaymentCard) => void
  skip: (skip: boolean) => void
}

const CardSelect: FunctionComponent<Props> = ({ cards, select, skip }) => {
  let cardSection: ReactElement
  if (cards) {
    const cardElems = cards.map((card) => {
      return <CardInfo key={card.id} card={card} onClick={() => select(card)} />
    })

    cardSection = <div className={styles.cardList}>{cardElems}</div>
  } else {
    cardSection = <Spinner size={100} text='Loading saved payment methods...' />
  }

  // Always want to present the option to use a new card in case user
  // doesn't want to wait for slow network
  return (
    <div className='main-container'>
      <h2>Saved Cards</h2>
      {cardSection}
      <Button onClick={() => skip(true)}>Use new card</Button>
    </div>
  )
}

export default CardSelect
