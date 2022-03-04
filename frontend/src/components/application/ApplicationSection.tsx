import { FunctionComponent } from 'react'
import Link from 'next/link'

import { Appstream } from '../../types/Appstream'

import ApplicationCard from './ApplicationCard'
import styles from './ApplicationSection.module.scss'
import Button from '../Button'
import { useTranslation } from 'next-i18next'

interface Props {
  href: string
  title: string
  applications: Appstream[]
  showMore?: boolean
}

const ApplicationSection: FunctionComponent<Props> = ({
  href,
  title,
  applications,
  showMore = true,
}) => {
  const { t } = useTranslation()
  return (
    <div className={styles.applicationsSection}>
      <header>
        <h3>{title}</h3>

        {showMore && <Link href={href} passHref>
          <a>
            <Button>{t('more')}</Button>
          </a>
        </Link>}
      </header>
      <div className={styles.applications}>
        {applications.map((app) => (
          <ApplicationCard key={app.id} application={app} />
        ))}
      </div>
    </div>
  )
}

export default ApplicationSection
