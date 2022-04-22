import { useTranslation } from 'next-i18next'
import { FunctionComponent, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { deleteAccount } from '../../context/actions'
import { useUserDispatch } from '../../context/user-info'
import { USER_DELETION_URL } from '../../env'
import { useAsync } from '../../hooks/useAsync'
import Button from '../Button'
import ConfirmDialog from '../ConfirmDialog'
import Spinner from '../Spinner'

/**
 * Performs a GET request to the API to initiate user deletion.
 */
async function requestDeletion() {
  let res: Response
  try {
    res = await fetch(USER_DELETION_URL, { credentials: 'include' })
  } catch {
    throw 'network-error-try-again'
  }

  if (res.ok) {
    const data = await res.json()
    if (data.status == 'ok') {
      return data.token
    } else {
      throw data.message
    }
  } else {
    throw 'network-error-try-again'
  }
}

const DeleteButton: FunctionComponent = () => {
  const { t } = useTranslation()
  const dispatch = useUserDispatch()

  const [token, setToken] = useState('')

  // Get token first, then use to delete
  const nextAction = token
    ? () => deleteAccount(dispatch, token)
    : requestDeletion

  const { execute, status, value, error } = useAsync(nextAction, false)

  // Alert user to network errors preventing deletion
  useEffect(() => {
    if (error) {
      toast.error(t(error))
    }
  }, [error, t])

  useEffect(() => {
    if (value) {
      setToken(value)
    }
  }, [value])

  if (status === 'pending') {
    return <Spinner size={30} />
  }

  if (token) {
    return (
      <ConfirmDialog
        prompt='Delete your account?'
        entry='I wish to delete my account'
        action={t('delete-account')}
        onConfirmed={execute}
        onCancelled={() => setToken('')}
      />
    )
  }

  return (
    <Button onClick={execute} variant='secondary'>
      {t('delete-account')}
    </Button>
  )
}

export default DeleteButton
