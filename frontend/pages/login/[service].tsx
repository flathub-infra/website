import { GetStaticPaths, GetStaticProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import Main from '../../src/components/layout/Main';
import Spinner from '../../src/components/Spinner';
import { login } from '../../src/context/actions';
import { useUserContext, useUserDispatch } from '../../src/context/user-info';
import { fetchLoginProviders } from '../../src/fetchers';


export default function AuthReturnPage({ services }) {
  // Must access query params to POST to backend for oauth verification
  const { t } = useTranslation();
  const router = useRouter()

  // Send only one request, prevent infinite loops
  const [sent, setSent] = useState(false)

  const user = useUserContext()
  const dispatch = useUserDispatch()

  useEffect(() => {
    // Redirect to userpage once logged in
    if (user.info && !user.loading) {
      router.push('/userpage')
    }

    // Router must be ready to access query parameters
    if (!router.isReady) { return }

    // Redirect away if user tries some kind of directory traversal
    if (
      services.every((s: string) => s !== router.query.service)
      || router.query.code == null
      || router.query.state == null
    ) {
      router.push(user.info ? '/userpage' : '/')
      return
    }

    if (!sent) {
      setSent(true)
      login(dispatch, toast.error, router.query)
    }
  }, [router, dispatch, user, sent, services])

  return (
    <Main>
      <NextSeo title={t('login')} noindex={true}></NextSeo>
      {user.loading ? <Spinner size={200} /> : <></>}
    </Main>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const data = await fetchLoginProviders()

  const services = data.map(d => d.method)

  return {
    props: {
      ...(await serverSideTranslations(locale, ['common'])),
      services
    },
    revalidate: 3600,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: 'blocking',
  }
}
