import { useTranslation } from 'next-i18next'
import { FunctionComponent, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { deleteAccount } from '../../context/actions'
import { useUserDispatch } from '../../context/user-info'
import { USER_DELETION_URL } from '../../env'
import Button from '../Button'
import ConfirmDialog from '../ConfirmDialog'
import Spinner from '../Spinner'


/**
 * Performs a GET request to the API to initiate user deletion.
 * @param waiting Function to set the async state of the component
 * @param error Function for displaying errors (usually component state)
 * @param success Callback accepting the deletion token on success
 */
async function requestDeletion(
  waiting: (a: boolean) => void,
  error: (msg: string) => void,
  success: (token: string) => void,
) {
  waiting(true)

  let res: Response
  try {
    res = await fetch(USER_DELETION_URL, { credentials: 'include' })
  } catch {
    error('A network error occured during deletion. Refresh and try again.')
    return
  } finally {
    waiting(false)
  }

  if (res.ok) {
    const data = await res.json()
    if (data.status == 'ok') {
      success(data.token)
    } else {
      error(data.message)
    }
  } else {
    error('A network error occured during deletion. Refresh and try again.')
  }
}


const DeleteButton: FunctionComponent = () => {
  const { t } = useTranslation()
  // Using state to prevent user repeatedly initating fetches
  const [clicked, setClicked] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [token, setToken] = useState('')
  const dispatch = useUserDispatch()

  // Only make a request on first click
  useEffect(() => {
    if (clicked) { requestDeletion(setWaiting, toast.error, setToken) }
  }, [dispatch, clicked])

  if (waiting) {
    return <Spinner size={30} />
  }

  if (token) {
    // Callbacks must clear the token to hide the dialog
    return <ConfirmDialog
      prompt='Delete your account?'
      entry='I wish to delete my account'
      action='Delete Account'
      onConfirmed={() => {
        deleteAccount(dispatch, setWaiting, toast.error, token)
        setToken('')
      }}
      onCancelled={() => {
        // Hide dialog and allow reuse of button
        setToken('')
        setClicked(false)
      }}
    />
  }

  return (
    <Button onClick={() => setClicked(true)} type='secondary'>
      {t('delete-account')}
    </Button>
  )
}

export default DeleteButton
