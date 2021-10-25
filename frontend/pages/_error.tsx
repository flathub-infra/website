import { NextSeo } from 'next-seo'
import Main from '../src/components/layout/Main'

function Error({ statusCode }) {
  return (
    <Main>
      <NextSeo title={`${statusCode}`} />
      <div className='store-content-container-narrow'>
        <h1>Whoops</h1>
        <p>
          {statusCode
            ? `An error ${statusCode} occurred on the server.`
            : 'An error occurred on the client.'}
        </p>
        <p>
          You might want to retry or go back <a href='.'>home</a>.
        </p>
      </div>
    </Main>
  )
}

Error.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode }
}

export default Error
