import { Urls } from '../../types/Appstream'
import ProjectUrlWidget from './ProjectUrl'
import styles from './ProjectUrls.module.scss'

const ProjectUrls = ({ urls, appId }: { urls: Urls; appId: string }) => {
  return (
    <div className={styles.urls}>
      {urls && (
        <>
          <div>
            {urls.homepage && (
              <ProjectUrlWidget
                id={appId}
                url={urls.homepage}
                type={'Homepage'}
              />
            )}

            {urls.contact && (
              <ProjectUrlWidget
                id={appId}
                url={urls.contact}
                type={'Contact'}
              />
            )}

            {urls.help && (
              <ProjectUrlWidget id={appId} url={urls.help} type={'Help'} />
            )}

            {urls.faq && (
              <ProjectUrlWidget id={appId} url={urls.faq} type={'Faq'} />
            )}
          </div>
          <div>
            {urls.bugtracker && (
              <ProjectUrlWidget
                id={appId}
                url={urls.bugtracker}
                type={'Bugtracker'}
              />
            )}

            {urls.translate && (
              <ProjectUrlWidget
                id={appId}
                url={urls.translate}
                type={'Translate'}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default ProjectUrls
