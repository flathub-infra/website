import Main from '../src/components/layout/Main'
import Link from 'next/link'
import {
  FEED_NEW_URL,
  FEED_RECENTLY_UPDATED_URL,
  IMAGE_BASE_URL,
} from '../src/env'
import { NextSeo } from 'next-seo'

const Feeds = () => (
  <Main>
    <NextSeo
      title='RSS'
      description='Subscribe to RSS feeds from Flathub'
      openGraph={{
        images: [
          {
            url: `${IMAGE_BASE_URL}badges/flathub-badge-en.png`,
          },
        ],
      }}
    />
    <div className='main-container center'>
      <h1>Flathub RSS feeds</h1>
      <p>
        You can now subscribe to our RSS feeds to get the latest Flathub goodies
        in your feed reader!
      </p>
      <h3>New Apps</h3>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <p>Applications published in Flathub in the last 30 days</p>
        <a href={FEED_NEW_URL}>
          <button className='primary-button'>Subscribe</button>
        </a>
      </div>
      <h3>New & Updated Apps</h3>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <p>Applications published or updated in Flathub in the last 7 days</p>
        <a href={FEED_RECENTLY_UPDATED_URL}>
          <button className='primary-button'>Subscribe</button>
        </a>
      </div>
      <h6 className='hint'>
        Do you need an RSS application? We have excellent ones in Flathub. Find
        them <Link href='/apps/search/rss'>here</Link>
      </h6>
    </div>
  </Main>
)

export default Feeds
