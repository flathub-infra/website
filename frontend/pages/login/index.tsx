import { GetStaticProps } from 'next'
import { NextSeo } from 'next-seo'
import Main from '../../src/components/layout/Main'
import LoginProviders from '../../src/components/login/Providers'
import { fetchLoginProviders } from '../../src/fetchers'
import { LoginProvider } from '../../src/types/Login'

export default function DeveloperLoginPortal({ providers }) {
  return (
    <Main>
      <NextSeo title='Developer Login' />
      <LoginProviders providers={providers}/>
    </Main>
  )
}

// Providers won't change often so fetch at build time for now
export const getStaticProps: GetStaticProps = async () => {
  const providers: LoginProvider[] = await fetchLoginProviders()

  return {
    props: {
      providers,
    }
  }
}
