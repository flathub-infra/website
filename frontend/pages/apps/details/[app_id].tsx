import Main from '../../../components/layout/Main'
import Application from './../../../components/application/Application'
import { useEffect, useState } from 'react'
import { BASE_URI } from './../../../env'
import { useRouter } from 'next/router'
import Appstream from '../../../types/Appstream'

export default function Details() {
  const [appAppstream, setAppAppstream] = useState(null)
  const router = useRouter()
  const appID = router.query.app_id

  useEffect(() => {
    fetch(`${BASE_URI}/appstream/${appID}`).then((r) => {
      r.json().then((appstream) => {
        if (appstream.screenshots) {
          appstream.screenshots = appstream.screenshots.map((screenshot) => {
            return {
              small: screenshot['112x63'],
              medium: screenshot['224x126'],
              default: screenshot['624x351'],
              large: screenshot['752x423']
            }
          })
        }
        setAppAppstream(appstream as Appstream)
      })
    })
  }, [appID])

  return (
    <Main>
      <div className='container'>
        <Application appstream={appAppstream} />
      </div>
    </Main>
  )
}
