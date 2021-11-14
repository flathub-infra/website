import { useMatomo } from '@datapunt/matomo-tracker-react'
import { ProjectUrl } from '../../types/ProjectUrl'
import styles from './ProjectUrl.module.scss'
import {
  MdOpenInNew,
  MdTranslate,
  MdOutlineBugReport,
  MdWeb,
  MdContactPage,
  MdHelp,
  MdQuestionAnswer,
} from 'react-icons/md'

const ProjectUrlWidget = ({
  url,
  type,
  id: appId,
}: {
  url: string
  type: ProjectUrl
  id: string
}) => {
  const { trackEvent } = useMatomo()

  const linkClicked = () => {
    trackEvent({ category: 'App', action: type, name: appId })
  }

  let label = ''
  let icon: string | JSX.Element
  switch (type) {
    case 'Homepage':
      label = 'Project Website'
      icon = <MdWeb />
      break
    case 'Bugtracker':
      label = 'Report an Issue'
      icon = <MdOutlineBugReport />
      break
    case 'Translate':
      label = 'Contribute translations'
      icon = <MdTranslate />
      break
    case 'Faq':
      label = 'Frequently Asked Questions'
      icon = <MdQuestionAnswer />
      break
    case 'Help':
      label = 'Help'
      icon = <MdHelp />
      break
    case 'Contact':
      label = 'Contact'
      icon = <MdContactPage />
      break
  }

  return (
    <div className={styles.url}>
      <div className={styles.icon}>{icon}</div>
      <div className={styles.details}>
        {label} <br />
        <a href={url} target='_blank' rel='noreferrer' onClick={linkClicked}>
          {url}
        </a>
      </div>
      <div className={styles.externalLink}>
        <a href={url} target='_blank' rel='noreferrer' onClick={linkClicked}>
          <MdOpenInNew />
        </a>
      </div>
    </div>
  )
}

export default ProjectUrlWidget
