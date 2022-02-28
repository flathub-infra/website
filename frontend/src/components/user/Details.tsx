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

  const {
    github_avatar,
    github_login,
    displayname,
    "dev-flatpaks": flatpaks
  } = user.info

  return (
    <div className='main-container'>
      <div className={styles.details}>
        <img
          src={github_avatar}
          className={styles.avatar}
          alt={`${github_login}'s avatar`}
        />
        <div className={styles.textDetails}>
          <h2>{displayname}</h2>
          <p>GitHub Account: <a href={`https://github.com/${github_login}`}
            target='_blank'
            rel='noreferrer'
            title='Open in new tab'>@{github_login}</a></p>
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
