import { useTranslation } from 'next-i18next'
import { FunctionComponent, useState, useEffect } from 'react'
import { LOGIN_PROVIDERS_URL } from '../../env'
import { LoginProvider, LoginRedirect } from '../../types/Login'
import FeedbackMessage from '../FeedbackMessage'
import styles from './ProviderLink.module.scss'

interface Props {
  provider: LoginProvider,
}

function loginMethod(provider: LoginProvider) {
  switch (provider.method) {
    case 'github':
      return 'GitHub'

    case 'gitlab':
      return 'GitLab'

    case 'google':
      return 'Google'

    default:
      break;
  }
}

const ProviderLink: FunctionComponent<Props> = ({
  provider
}) => {
  const { t } = useTranslation()
  // Using state to prevent user repeatedly initiating fetches
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
        setError(t('network-error-try-again'))
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
  }, [clicked, provider.method, t])

  const loginText = t(`login-with-provider`, { provider: loginMethod(provider) })

  return (
    <>
      <button className={styles.provider} onClick={() => setClicked(true)}>
        <img src={provider.button} width='60' height='60' alt={loginText}></img>
        {loginText}
      </button>
      {error ? <FeedbackMessage success={false} message={error} /> : <></>}
    </>
  )
}

export default ProviderLink
