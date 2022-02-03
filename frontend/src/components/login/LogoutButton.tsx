import { FunctionComponent, useState, useEffect } from 'react'
import { logout } from '../../context/actions'
import { useUserDispatch } from '../../context/user-info'
import Button from '../Button'

const LogoutButton: FunctionComponent = () => {
  // Using state to prevent user repeatedly initating fetches
  const [clicked, setClicked] = useState(false)

  const dispatch = useUserDispatch()

  // Only make a request on first click
  useEffect(() => {
    if (clicked) { logout(dispatch) }
  }, [dispatch, clicked])

  return (
    <Button onClick={() => setClicked(true)} type='primary'>
      Log Out
    </Button>
  )
}

export default LogoutButton
