import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import Main from '../../src/components/layout/Main';
import { login } from '../../src/context/actions';
import { useUserContext, useUserDispatch } from '../../src/context/user-info';

export default function AuthReturnPage() {
  // Must access query params to POST to backend for verification with GitHub
  const router = useRouter()

  const user = useUserContext()
  const dispatch = useUserDispatch()

  // Redirect to userpage once logged in
  if (user.info) {
    router.push('/userpage')
  }

  useEffect(() => {
    // Router must be ready to access query parameters
    // This must be a dependency to ensure only runs once
    if (!router.isReady) { return }

    // Redirect to home if user tries some kind of directory traversal
    if (router.query.code == null || router.query.state == null) {
      router.push('/')
      return
    }

    login(dispatch, router.query)
  }, [router, dispatch])

  return (
    <Main>
      <NextSeo title='Login' noindex={true}></NextSeo>
    </Main>
  )
}
