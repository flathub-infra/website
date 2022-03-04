import { GetStaticProps } from 'next'
import { NextSeo } from 'next-seo'
import Router from 'next/router'
import { ReactElement, useEffect } from 'react'
import Main from '../src/components/layout/Main'
import Spinner from '../src/components/Spinner'
import UserDetails from '../src/components/user/Details'
import UserApps from '../src/components/user/UserApps'
import { useUserContext } from '../src/context/user-info'
import { fetchLoginProviders } from '../src/fetchers'
import { LoginProvider } from '../src/types/Login'
import styles from './userpage.module.scss'

export default function Userpage({ providers }) {
  const user = useUserContext()

  // Nothing to show if not logged in, return to home
  useEffect(() => {
    if (!user.info && !user.loading) {
      Router.push('/')
    }
  }, [user])

  let content: ReactElement
  if (user.loading || !user.info) {
    content = <Spinner size={150} />
  } else {
    // Buttons above apps so they're on screen when page loads (for action visibility)
    content =
      <div className={styles.userArea}>
        <UserDetails logins={providers} />
        <UserApps />
      </div>
  }

  return (
    <Main>
      <NextSeo title='User page' noindex={true} />
      {content}
    </Main>
  )
}

// Need available login providers to show options on page
export const getStaticProps: GetStaticProps = async () => {
  const providers: LoginProvider[] = await fetchLoginProviders()

  return {
    props: {
      providers,
    }
  }
}
