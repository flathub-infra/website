import { NextSeo } from 'next-seo'
import Router from 'next/router'
import { ReactElement, useEffect } from 'react'
import Main from '../src/components/layout/Main'
import LogoutButton from '../src/components/login/LogoutButton'
import Spinner from '../src/components/Spinner'
import UserDetails from '../src/components/user/Details'
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
    content = <div className={styles.userArea}>
      <UserDetails />
      {/* TODO: Flatpaks here */}
      <div><LogoutButton /></div>
    </div>
  }

  return (
    <Main>
      <NextSeo title='User page' noindex={true} />
      {content}
    </Main>
  )
}
