import { Appstream, Urls } from '../../types/Appstream'
import { Summary } from '../../types/Summary'
import List from './List'
import ProjectUrlWidget from './ProjectUrl'
import styles from './ProjectUrls.module.scss'
import { MdDownload } from 'react-icons/md'
import { BsHddFill } from 'react-icons/bs'
import { MdLaptop } from 'react-icons/md'

const ProjectUrls = ({
  data,
  summary,
  appId,
}: {
  data: Appstream
  summary: Summary
  appId: string
}) => {
  return (
    <div className={styles.urls}>
      {data.urls && (
        <>
          <div>
            {data.urls.homepage && (
              <ProjectUrlWidget
                id={appId}
                url={data.urls.homepage}
                type={'Homepage'}
              />
            )}

            {data.urls.contact && (
              <ProjectUrlWidget
                id={appId}
                url={data.urls.contact}
                type={'Contact'}
              />
            )}

            {data.urls.help && (
              <ProjectUrlWidget id={appId} url={data.urls.help} type={'Help'} />
            )}

            {data.urls.faq && (
              <ProjectUrlWidget id={appId} url={data.urls.faq} type={'Faq'} />
            )}
          </div>
          <div>
            {data.urls.bugtracker && (
              <ProjectUrlWidget
                id={appId}
                url={data.urls.bugtracker}
                type={'Bugtracker'}
              />
            )}

            {data.urls.translate && (
              <ProjectUrlWidget
                id={appId}
                url={data.urls.translate}
                type={'Translate'}
              />
            )}
          </div>
          <List
            items={[
              { icon: '', header: 'License', content: data.project_license },
            ]}
          ></List>
          {/* {data.content_rating} */}
          <List
            items={[
              {
                icon: <MdLaptop />,
                header: 'Available architectures',
                content: summary.arches.join(', '),
              },
            ]}
          ></List>
          <List
            items={[
              {
                icon: <BsHddFill />,
                header: 'Installed size',
                content: Math.round(summary.installed_size / 1000000) + ' MB',
              },
              {
                icon: <MdDownload />,
                header: 'Download size',
                content: Math.round(summary.download_size / 1000000) + ' MB',
              },
            ]}
          ></List>
        </>
      )}
    </div>
  )
}

export default ProjectUrls
