import Link from 'next/link'
import styles from './Footer.module.scss'
import LoginStatus from '../login/Status'

const Footer = () => (
  <footer id={styles.footer}>
    <div className={styles.footerContainer}>
      <div className={styles.footerSection}>
        <div className={styles.footerTitle}>Applications</div>
        <div className={styles.footerItems}>
          <div className={styles.footerItem}>
            <Link href='/apps/collection/popular'>Popular</Link>
          </div>
          <div className={styles.footerItem}>
            <Link href='/apps/collection/recently-updated'>New & Updated</Link>
          </div>
          <div className={styles.footerItem}>
            <Link href='/apps/collection/editors-choice-apps'>
              Editor&apos;s Choice
            </Link>
          </div>
          <div className={styles.footerItem}>
            <Link href='/apps/collection/editors-choice-games'>
              Editor&apos;s Choice Games
            </Link>
          </div>
          <div className={styles.footerItem}>
            <Link href='/apps'>Browse Apps</Link>
          </div>
          <div className={styles.footerItem}>
            <Link href='/feeds'>RSS Feeds</Link>
          </div>
        </div>
      </div>

      <div className={styles.footerSection}>
        <div className={styles.footerTitle}>Community</div>
        <div className={styles.footerItems}>
          <div className={styles.footerItem}>
            <a
              href='https://flatpak.org/about/'
              target='_blank'
              rel='noreferrer'
            >
              Get involved
            </a>
          </div>
          <div className={styles.footerItem}>
            <a
              href='https://discourse.flathub.org/'
              target='_blank'
              rel='noreferrer'
            >
              Forum
            </a>
          </div>
          <div className={styles.footerItem}>
            <a
              href='https://twitter.com/FlatpakApps'
              target='_blank'
              rel='noreferrer'
            >
              Follow us
            </a>
          </div>
        </div>
      </div>

      <div className={styles.footerSection}>
        <div className={styles.footerTitle}>Developers</div>
        <div className={styles.footerItems}>
          <div className={styles.footerItem}>
            <a href='https://github.com/flathub/flathub/wiki/App-Submission'>
              Publish your app
            </a>
          </div>
          <div className={styles.footerItem}>
            <a href='http://docs.flatpak.org/'>Documentation</a>
          </div>
          <div className={styles.footerItem}>
            <a href='https://github.com/flathub/'>Example build files</a>
          </div>
          <div className={styles.footerItem}>
            <Link href='/badges'>Badges</Link>
          </div>
        </div>
      </div>

      <div className={styles.footerSection}>
        <div className={styles.footerTitle}>Flathub</div>
        <div className={styles.footerItems}>
          <div className={styles.footerItem}>
            <Link href='/about'>About</Link>
          </div>
          <div className={styles.footerItem}>
            <Link href='/statistics'>Statistics</Link>
          </div>
          <div className={styles.footerItem}>
            <a
              href='https://github.com/flathub/frontend'
              target='_blank'
              rel='noreferrer'
            >
              Source code
            </a>
          </div>
        </div>
      </div>

      <div className={styles.footerSection}>
        <LoginStatus />
      </div>
    </div>
  </footer>
)

export default Footer
