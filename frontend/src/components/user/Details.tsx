import { useTranslation } from 'next-i18next'
import { FunctionComponent } from 'react'
import { useUserContext } from '../../context/user-info'
import LogoutButton from '../login/LogoutButton'
import DeleteButton from './DeleteButton'
import { LoginProvider } from '../../types/Login'
import styles from './Details.module.scss'
import ProviderLink from '../login/ProviderLink'

interface Props {
  logins: LoginProvider[]
}

const UserDetails: FunctionComponent<Props> = ({ logins }) => {
  const user = useUserContext()
  const { t } = useTranslation();

  // Nothing to show if not logged in
  if (!user.info) {
    return <></>
  }

  // Accounts may or may not be present in user information
  const linkedAccounts = Object.keys(user.info.auths).map(name => {
    const authData = user.info.auths[name]

    return (<div key={name} className={styles.linked}>
      <img
        src={authData.avatar}
        className={styles.avatar}
        alt={`${authData.login}'s avatar`}
      />
      <p><b>{name}</b><br />{authData.login}</p>
    </div>)
  })

  // The user may have further sign in options available
  const linkOptions = logins
    .filter(provider => !user.info.auths[provider.method])
    .map(provider => <ProviderLink key={provider.method} provider={provider} />)

  const loginSection = linkOptions.length
    ? <div className={styles.subsection}>
      <h3>{t('link-more-accounts')}</h3>
      <div className={styles.authList}>
        {linkOptions}
      </div>
    </div>
    : <></>

  return (
    <div className='main-container'>
      <div className={styles.details}>
        <h2 className={styles.displayname}>{user.info.displayname}</h2>

        <div className={styles.subsection}>
          <h3>{t('linked-accounts')}</h3>
          <div className={styles.authList}>
            {linkedAccounts}
          </div>
        </div>

        {loginSection}

        <div className={styles.actions}>
          <LogoutButton />
          <DeleteButton />
        </div>

      </div>
    </div >
  )
}

export default UserDetails
