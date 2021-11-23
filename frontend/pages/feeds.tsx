import Main from '../src/components/layout/Main'
import Link from 'next/link'
import { FEED_NEW_URL, FEED_RECENTLY_UPDATED_URL } from '../src/env'
import { NextSeo } from 'next-seo'
import Button from '../src/components/Button'

const Feeds = () => (
  <Main>
    <NextSeo title='RSS' description='Subscribe to RSS feeds from Flathub' />
    <div className='store-content-container-narrow'>
      <h1>Flathub RSS feeds</h1>
      <p>
        You can now subscribe to our RSS feeds to get the latest Flathub goodies
        in your feed reader!
      </p>
      <h3>New Apps</h3>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <p>Applications published in Flathub in the last 30 days</p>
        <a href={FEED_NEW_URL}>
          <Button>Subscribe</Button>
        </a>
      </div>
      <h3>New & Updated Apps</h3>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <p>Applications published or updated in Flathub in the last 7 days</p>
        <a href={FEED_RECENTLY_UPDATED_URL}>
          <Button>Subscribe</Button>
        </a>
      </div>

      <h6
        style={{
          marginTop: '0.5em !important',
          color: 'var(--text-secondary)',
        }}
      >
        Do you need an RSS application? We have excellent ones in Flathub. Find
        them <Link href='/apps/search/rss'>here</Link>
      </h6>
    </div>
  </Main>
)

export default Feeds
