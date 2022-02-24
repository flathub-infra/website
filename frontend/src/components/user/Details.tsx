import { FunctionComponent } from 'react'
import { useUserContext } from '../../context/user-info'
import LogoutButton from '../login/LogoutButton'
import DeleteButton from './DeleteButton'
import styles from './Details.module.scss'

const UserDetails: FunctionComponent = () => {
  const user = useUserContext()

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
      <p><b>{name}</b><br/>{authData.login}</p>
    </div>)
  })

  return (
    <div className='main-container'>
      <div className={styles.details}>
        <h2 className={styles.displayname}>{user.info.displayname}</h2>
        <div className={styles.subsection}>
          <h3>Linked Accounts</h3>
          <div className={styles.authList}>
            {linkedAccounts}
          </div>
        </div>
        <div className={styles.actions}>
          <LogoutButton />
          <DeleteButton />
        </div>
      </div>
    </div >
  )
}

export default UserDetails
