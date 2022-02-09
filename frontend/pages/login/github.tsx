import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import FeedbackMessage from '../../src/components/FeedbackMessage';
import Main from '../../src/components/layout/Main';
import { login } from '../../src/context/actions';
import { useUserContext, useUserDispatch } from '../../src/context/user-info';

export default function AuthReturnPage() {
  // Must access query params to POST to backend for verification with GitHub
  const router = useRouter()

  // Send only one request, prevent infinite loops
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const user = useUserContext()
  const dispatch = useUserDispatch()

  useEffect(() => {
    // Redirect to userpage once logged in
    if (user.info && !user.loading) {
      router.push('/userpage')
    }

    // Router must be ready to access query parameters
    // This must be a dependency to ensure only runs once
    if (!router.isReady) { return }

    // Redirect to home if user tries some kind of directory traversal
    if (router.query.code == null || router.query.state == null) {
      router.push('/')
      return
    }

    if (!sent) {
      setSent(true)
      login(dispatch, setError, router.query)
    }
  }, [router, dispatch, user, sent])

  return (
    <Main>
      <NextSeo title='Login' noindex={true}></NextSeo>
      {error ? <FeedbackMessage success={false} message={error} /> : <></>}
    </Main>
  )
}
