import { FunctionComponent, useState, useEffect } from 'react'
import { LOGIN_PROVIDERS_URL } from '../../env'
import { LoginProvider, LoginRedirect } from '../../types/Login'
import FeedbackMessage from '../FeedbackMessage'
import styles from './ProviderLink.module.scss'

interface Props {
  provider: LoginProvider,
}

const ProviderLink: FunctionComponent<Props> = ({
  provider
}) => {
  // Using state to prevent user repeatedly initating fetches
  const [clicked, setClicked] = useState(false)
  const [error, setError] = useState('')

  // When user clicks a provider, a redirect is fetched to initiate login flow
  useEffect(() => {
    const redirect = async (url: string) => {
      let res: Response
      try {
        res = await fetch(url, {
          // Must use the session cookie sent back
          credentials: 'include',
          // Redirects are unique each time
          cache: 'no-store',
        })
      } catch {
        // Allow the user to try again on network error
        setError('There was a network error. Try again.')
        setClicked(false)
        return
      }

      if (res.ok) {
        const data: LoginRedirect = await res.json()
        window.location.href = data.redirect
      } else {
        setError(`${res.status} ${res.statusText}`)
        setClicked(false)
      }
    }

    if (clicked) {
      setError('')
      redirect(`${LOGIN_PROVIDERS_URL}/${provider.method}`)
    }
  }, [clicked, provider.method])

  return (
    <>
    <button className={styles.provider} onClick={() => setClicked(true)}>
      <img src={provider.button} width='60' height='60' alt=''></img>
      {provider.text}
    </button>
    {error ? <FeedbackMessage success={false} message={error} /> : <></>}
    </>
  )
}

export default ProviderLink
