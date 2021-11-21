import { FunctionComponent } from 'react'
import Link from 'next/link'

import { Appstream } from '../../types/Appstream'

import ApplicationCard from './ApplicationCard'
import styles from './ApplicationSection.module.scss'
import Button from '../Button'

interface Props {
  href: string
  title: string
  applications: Appstream[]
}

const ApplicationSection: FunctionComponent<Props> = ({
  href,
  title,
  applications,
}) => (
  <div className={styles.applicationsSection}>
    <header>
      <h3>{title}</h3>

      <Link href={href} passHref>
        <a>
          <Button>Show more</Button>
        </a>
      </Link>
    </header>
    <div className={styles.applications}>
      {applications.map((app) => (
        <ApplicationCard key={app.id} application={app} />
      ))}
    </div>
  </div>
)

export default ApplicationSection
