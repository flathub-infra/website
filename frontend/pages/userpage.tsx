import { NextSeo } from 'next-seo'
import Router from 'next/router'
import { ReactElement, useEffect } from 'react'
import Main from '../src/components/layout/Main'
import LogoutButton from '../src/components/login/LogoutButton'
import Spinner from '../src/components/Spinner'
import UserDetails from '../src/components/user/Details'
import UserApps from '../src/components/user/UserApps'
import { useUserContext } from '../src/context/user-info'
import styles from './userpage.module.scss'

export default function Userpage() {
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
    content = <div className={styles.userArea}>
      <UserDetails />
      <div><LogoutButton /></div>
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
