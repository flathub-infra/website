import { FunctionComponent } from 'react'
import Link from 'next/link'

import { Appstream } from '../../types/Appstream'
import styles from './ApplicationCard.module.scss'

interface Props {
  application: Appstream
}

const ApplicationCard: FunctionComponent<Props> = ({ application }) => (
  <Link href={`/apps/details/${application.id}`} passHref>
    <a className={styles.applicationCard}>
      <div className={styles.logo}>
        <img src={application.icon} alt={application.name} />
      </div>
      <div className={styles.summary}>
        <h5>{application.name}</h5>
        <p>{application.summary}</p>
      </div>
    </a>
  </Link>
)

export default ApplicationCard
