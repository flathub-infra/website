import Main from '../src/components/layout/Main'
import Image from '../src/components/Image'
import CodeCopy from '../src/components/application/CodeCopy'
import { NextSeo } from 'next-seo'
import styles from './badges.module.scss'
import flathubBadge from '/public/assets/badges/flathub-badge-en.png'
import flathubBadgeInverted from '/public/assets/badges/flathub-badge-i-en.png'
import cc0 from '/public/img/CC0.png'

const badgeExampleCode =
  "<a href='https://flathub.org/apps/details/org.gimp.GIMP'><img width='240' alt='Download on Flathub' src='https://flathub.org/assets/badges/flathub-badge-en.png'/></a>"
const badgeExampleCodeMoinMoin =
  '[[https://flathub.org/apps/details/org.gimp.GIMP|{{https://flathub.org/assets/badges/flathub-badge-en.png|Download on Flathub|width=240,align=middle}}]]'

const Badges = () => (
  <Main>
    <NextSeo
      title='Flathub Official Badges'
      description='Official badges to promote your application on Flathub'
    />
    <section className={`main-container ${styles.badges}`}>
      <h1>Flathub official badges</h1>
      <p>You can use these badges to promote your application on Flathub</p>

      <div className={styles.badgeFlex}>
        <div>
          <h3>Preferred badge</h3>
          <Image
            width='240'
            height='80'
            alt='Download on Flathub'
            src={flathubBadge}
          />
          <h6>
            Also available in{' '}
            <a href='/assets/badges/flathub-badge-en.svg'>svg format</a>
          </h6>
        </div>

        <div>
          <h3>Alternative badge</h3>
          <Image
            width='240'
            height='80'
            alt='Download on Flathub'
            src={flathubBadgeInverted}
          />
          <h6>
            Also available in{' '}
            <a href='/assets/badges/flathub-badge-i-en.svg'>svg format</a>
          </h6>
        </div>
      </div>

      <p
        // this is a workaround for react not supporting it: https://github.com/facebook/react/issues/16563
        {...{
          'xmlns.dct': 'http://purl.org/dc/terms/',
          'xmlns.vcard': 'http://www.w3.org/2001/vcard-rdf/3.0#',
        }}
      >
        <a
          rel='license'
          href='http://creativecommons.org/publicdomain/zero/1.0/'
        >
          <Image src={cc0} alt='CC0' />
        </a>
        <br />
        To the extent possible under law,
        <a rel='dct:publisher' href='https://flathub.org/badges'>
          {' '}
          <span property='dct:title'>Jakub Steiner</span>{' '}
        </a>
        has waived all copyright and related or neighboring rights to
        <span property='dct:title'>Flathub Badges</span>. This work is published
        from: Czech Republic.
      </p>

      <h2>Code examples</h2>

      <div className={styles.badgeFlex}>
        <div>
          <h3>HTML</h3>
          <CodeCopy
            className={styles.copyCode}
            text={badgeExampleCode}
          ></CodeCopy>
          <a href='https://flathub.org/apps/details/org.gimp.GIMP'>
            <Image
              width={240}
              height={80}
              alt='Download on Flathub'
              src={flathubBadge}
            />
          </a>
        </div>
        <div>
          <h3>MoinMoin Wiki</h3>
          <CodeCopy
            className={styles.copyCode}
            text={badgeExampleCodeMoinMoin}
          ></CodeCopy>
          <a href='https://flathub.org/apps/details/org.gimp.GIMP'>
            <Image
              width={240}
              height={80}
              alt='Download on Flathub'
              src={flathubBadge}
            />
          </a>
        </div>
      </div>
    </section>
  </Main>
)

export default Badges
