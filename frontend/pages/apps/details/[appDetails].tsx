import { GetStaticPaths, GetStaticProps } from 'next'
import ApplicationDetails from '../../../src/components/application/Details'
import Main from '../../../src/components/layout/Main'

export default function Details({ data }) {
  return (
    <Main>
      <ApplicationDetails data={data} />
    </Main>
  )
}

export const getStaticProps: GetStaticProps = async ({params: {appDetails}}) => {
  console.log("Fetching data for app details: ", appDetails)
  const appData = await fetch(`https://flathub-backend.openshift.gnome.org/master/appstream/${appDetails}`)
  const data = await appData.json();

  return {
    props: {
      data
    }
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  const apps = await fetch("https://flathub-backend.openshift.gnome.org/master/appstream");
  const appsData = await apps.json();
  const paths = appsData.map(app => ({params: {appDetails: app}}))

  return {
    paths,
    fallback: false
  }
}
