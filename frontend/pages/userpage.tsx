import { NextSeo } from 'next-seo'
import Router from 'next/router'
import Main from '../src/components/layout/Main'
import LogoutButton from '../src/components/login/LogoutButton'
import UserDetails from '../src/components/user/Details'
import { useUserContext } from '../src/context/user-info'
import styles from './userpage.module.scss'

export default function Userpage() {
  const user = useUserContext()

  return (
    <Main>
      <NextSeo title='User page' noindex={true} />
      <div className={styles.userArea}>
        <UserDetails />
        {/* TODO: Flatpaks here */}
        <div><LogoutButton /></div>
      </div>
    </Main>
  )
}
