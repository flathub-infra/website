import { useTranslation } from 'next-i18next'
import { FunctionComponent, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { logout } from '../../context/actions'
import { useUserDispatch } from '../../context/user-info'
import Button from '../Button'

const LogoutButton: FunctionComponent = () => {
  const { t } = useTranslation()
  // Using state to prevent user repeatedly initating fetches
  const [clicked, setClicked] = useState(false)
  const dispatch = useUserDispatch()

  // Only make a request on first click
  useEffect(() => {
    if (clicked) {
      logout(dispatch).catch((err) => {
        toast.error(t(err))
        setClicked(false)
      })
    }
  }, [dispatch, clicked, t])

  return (
    <Button onClick={() => setClicked(true)} variant='primary'>
      {t('log-out')}
    </Button>
  )
}

export default LogoutButton
