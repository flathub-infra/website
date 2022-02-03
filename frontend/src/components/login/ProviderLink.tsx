import { FunctionComponent, useState, useEffect } from 'react'
import { LoginProvider, LoginRedirect } from '../../types/Login'
import styles from './Providers.module.scss'

interface Props {
  provider: LoginProvider,
}

const ProviderLink: FunctionComponent<Props> = ({
  provider
}) => {
  // Using state to prevent user repeatedly initating fetches by clicking
  // while loading
  const [clicked, setClicked] = useState(false)

  // When user clicks a provider, a redirect is fetched to initiate login flow
  useEffect(() => {
    const redirect = async (url: string) => {
      const res = await fetch(url, {
        credentials: 'include', // Must use the session cookie sent back
        cache: 'no-store', // Redirects are unique each time
      })

      // TODO something with bad responses
      if (res.ok) {
        const data: LoginRedirect = await res.json()
        window.location.href = data.redirect
      }
    }

    // Only make a request on first click
    if (clicked) {
      // TODO: catch network errors and show some feedback
      redirect(provider.method)
    }
  }, [clicked, provider.method])

  return (
    <button className={styles.provider} onClick={() => setClicked(true)}>
      <img src={provider.button} width='60' height='60' alt=''></img>
      {provider.text}
    </button>
  )
}

export default ProviderLink
