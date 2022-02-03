import { FunctionComponent } from 'react'
import { useUserContext } from '../../context/user-info'
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
    <div className={styles.details}>
      <img
        src={github_avatar}
        className={styles.avatar}
      />
      <div className={styles.textDetails}>
        <h2>{displayname}</h2>
        <p>GitHub Account: <a href={`https://github.com/${github_login}`}>@{github_login}</a></p>
      </div>
    </div>
  )
}

export default UserDetails
