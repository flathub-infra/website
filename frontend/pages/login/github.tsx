import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Main from '../../src/components/layout/Main';
import { getUserData } from '../../src/context/actions';
import { useUserDispatch } from '../../src/context/user-info';
import { LOGIN_PROVIDERS_URL } from '../../src/env';
import Error from '../_error';

export default function AuthReturnPage() {
  // Must access query params to POST to backend for verification with GitHub
  const router = useRouter()

  // Use state to rerender when request resolves
  const [status, setStatus] = useState(null)
  const [feedback, setFeedback] = useState('Awaiting server')

  const dispatch = useUserDispatch()

  useEffect(() => {
    // Router must be ready to access query parameters
    // This must be a dependency to ensure only runs once
    if (!router.isReady) { return }

    // Show 404 if user tries some kind of directory traversal
    if (router.query.code == null || router.query.state == null) {
      setStatus(404)
      return
    }

    const postRequest = async (url: string) => {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include', // Must use the session cookie
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: router.query.code,
          state: router.query.state,
        })
      })

      if (res.ok) {
        // May just want to redirect on successful login
        getUserData(dispatch)
        setFeedback('Success')
      } else {
        // Bad response codes
        // Note: Some of these come with an error message from backend we could display
        setStatus(res.status)
      }
    }

    // Catches any unexpected network errors
    postRequest(`${LOGIN_PROVIDERS_URL}/github`)
      .catch(() => setFeedback('Network error, please try again'))
  }, [router])

  if (status) {
    return <Error statusCode={status}></Error>
  }

  // Only show error page if status is set
  return (
    <Main>
      <p>{feedback}</p>
    </Main>
  )
}
