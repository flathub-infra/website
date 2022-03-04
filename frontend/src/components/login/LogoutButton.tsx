import { useTranslation } from 'next-i18next'
import { FunctionComponent, useEffect, useState } from 'react'
import { logout } from '../../context/actions'
import { useUserDispatch } from '../../context/user-info'
import Button from '../Button'
import FeedbackMessage from '../FeedbackMessage'

const LogoutButton: FunctionComponent = () => {
  const { t } = useTranslation()
  // Using state to prevent user repeatedly initating fetches
  const [clicked, setClicked] = useState(false)
  const [error, setError] = useState('')
  const dispatch = useUserDispatch()

  // Only make a request on first click
  useEffect(() => {
    if (clicked) { logout(dispatch, setError) }
  }, [dispatch, clicked])

  // There may have been a network error
  if (error) {
    return <FeedbackMessage success={false} message={error} />
  }

  return (
    <Button onClick={() => setClicked(true)} type='primary'>
      {t('log-out')}
    </Button>
  )
}

export default LogoutButton
